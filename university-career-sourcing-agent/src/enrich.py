"""
Email and phone enrichment from provided staff page URLs only.
"""
import json
import re
import requests
from bs4 import BeautifulSoup
from typing import Dict, List, Optional, Tuple
import pandas as pd
import logging
import time

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# HTTP request defaults
DEFAULT_TIMEOUT = 12
DEFAULT_USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

# Regex patterns for email and phone extraction
EMAIL_PATTERN = re.compile(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b')
PHONE_PATTERN = re.compile(r'(\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})')


def normalize_name(name: str) -> str:
    """
    Normalize name for matching against web pages.
    Removes common prefixes/suffixes and converts to lowercase.
    """
    if pd.isna(name) or not name:
        return ""
    
    name_lower = name.lower().strip()
    # Remove common prefixes/suffixes
    name_lower = re.sub(r'\b(jr|sr|iii|ii|iv|phd|dr|professor|prof)\b', '', name_lower)
    name_lower = ' '.join(name_lower.split())
    return name_lower


def extract_emails_phones_from_text(text: str) -> Tuple[List[str], List[str]]:
    """
    Extract emails and phone numbers from text using regex.
    
    Returns:
        Tuple of (list of emails, list of phones)
    """
    emails = list(set(EMAIL_PATTERN.findall(text)))
    phone_matches = PHONE_PATTERN.findall(text)
    # Format phones
    formatted_phones = []
    seen_phones = set()
    for phone_match in phone_matches:
        if isinstance(phone_match, tuple):
            # Phone pattern returns groups - combine them
            # Remove empty strings and format
            parts = [str(p) for p in phone_match if p]
            if len(parts) >= 3:  # At least area code + exchange + number
                formatted = ''.join(parts)
                if formatted and formatted not in seen_phones:
                    formatted_phones.append(formatted)
                    seen_phones.add(formatted)
        else:
            if phone_match and phone_match not in seen_phones:
                formatted_phones.append(phone_match)
                seen_phones.add(phone_match)
    
    return emails, formatted_phones


def fetch_page_content(url: str, timeout: int = DEFAULT_TIMEOUT) -> Optional[str]:
    """
    Fetch page content from URL.
    
    Returns:
        Page HTML content or None if error
    """
    try:
        headers = {'User-Agent': DEFAULT_USER_AGENT}
        response = requests.get(url, headers=headers, timeout=timeout)
        response.raise_for_status()
        return response.text
    except requests.exceptions.Timeout:
        logger.warning(f"Timeout fetching {url}")
        return None
    except requests.exceptions.RequestException as e:
        logger.warning(f"Error fetching {url}: {e}")
        return None


def find_contact_info_on_page(url: str, contact_name: str) -> Tuple[Optional[str], Optional[str]]:
    """
    Find email and phone for a contact on a staff page.
    
    Strategy:
    1. Fetch the page
    2. Parse HTML with BeautifulSoup
    3. Look for the contact's name in the text
    4. If found, extract nearby emails/phones
    5. If multiple matches, prefer email/phone near the name
    
    Returns:
        Tuple of (email or None, phone or None)
    """
    html_content = fetch_page_content(url)
    if not html_content:
        return None, None
    
    try:
        soup = BeautifulSoup(html_content, 'lxml')
        text = soup.get_text()
        
        # Normalize contact name for matching
        normalized_name = normalize_name(contact_name)
        if not normalized_name:
            return None, None
        
        # Check if name appears in page
        # We'll do a simple check - if the name words appear near each other
        name_words = normalized_name.split()
        if len(name_words) < 2:
            return None, None
        
        # Check if at least first and last name appear in text
        text_lower = text.lower()
        first_name = name_words[0]
        last_name = name_words[-1] if len(name_words) > 1 else ""
        
        if first_name not in text_lower or (last_name and last_name not in text_lower):
            # Name not found on page
            return None, None
        
        # Extract all emails and phones from page
        all_emails, all_phones = extract_emails_phones_from_text(text)
        
        # Try to find email/phone near the name
        # Strategy: look for email/phone in the same paragraph or nearby text block
        paragraphs = soup.find_all(['p', 'div', 'td', 'li'])
        
        best_email = None
        best_phone = None
        
        for para in paragraphs:
            para_text = para.get_text().lower()
            
            # Check if this paragraph contains the name
            if first_name in para_text and (not last_name or last_name in para_text):
                # Found name in this paragraph, extract nearby emails/phones
                para_html = str(para)
                para_emails, para_phones = extract_emails_phones_from_text(para_html)
                
                if para_emails and not best_email:
                    best_email = para_emails[0]
                if para_phones and not best_phone:
                    best_phone = para_phones[0]
        
        # If no email/phone found near name, but name is on page, use first found
        if not best_email and all_emails:
            best_email = all_emails[0]
        if not best_phone and all_phones:
            best_phone = all_phones[0]
        
        return best_email, best_phone
        
    except Exception as e:
        logger.warning(f"Error parsing page {url}: {e}")
        return None, None


def enrich_contacts_from_staff_pages(
    df: pd.DataFrame,
    staff_pages_path: str
) -> pd.DataFrame:
    """
    Enrich contacts with email and phone from provided staff page URLs.
    
    Only fetches URLs provided in staff_pages.json.
    Only extracts info if contact's name appears on the page.
    
    Returns:
        DataFrame with added 'email' and 'phone' columns
    """
    df = df.copy()
    
    # Initialize email and phone columns if they don't exist
    if 'email' not in df.columns:
        df['email'] = None
    if 'phone' not in df.columns:
        df['phone'] = None
    
    # Load staff pages config
    try:
        with open(staff_pages_path, 'r') as f:
            staff_pages = json.load(f)
    except FileNotFoundError:
        logger.warning(f"Staff pages file not found: {staff_pages_path}. Skipping enrichment.")
        return df
    except json.JSONDecodeError as e:
        logger.error(f"Error parsing staff_pages.json: {e}. Skipping enrichment.")
        return df
    
    # Group contacts by school
    school_groups = df.groupby('school')
    
    for school, school_df in school_groups:
        if school not in staff_pages or not staff_pages[school]:
            continue
        
        urls = staff_pages[school]
        logger.info(f"Enriching {len(school_df)} contacts from {school} using {len(urls)} URLs")
        
        for idx, row in school_df.iterrows():
            contact_name = row['name']
            
            # Skip if already has email and phone
            if pd.notna(row.get('email')) and pd.notna(row.get('phone')):
                continue
            
            # Try each URL for this school
            for url in urls:
                logger.info(f"  Checking {url} for {contact_name}")
                email, phone = find_contact_info_on_page(url, contact_name)
                
                if email:
                    df.at[idx, 'email'] = email
                    logger.info(f"    Found email: {email}")
                
                if phone:
                    df.at[idx, 'phone'] = phone
                    logger.info(f"    Found phone: {phone}")
                
                # If we found both, no need to check other URLs
                if email and phone:
                    break
                
                # Small delay to be respectful
                time.sleep(0.5)
    
    return df
