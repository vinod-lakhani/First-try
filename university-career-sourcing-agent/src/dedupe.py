"""
Deduplication logic for contacts.
"""
import pandas as pd
from rapidfuzz import fuzz
from typing import Tuple


def dedupe_by_linkedin_url(df: pd.DataFrame) -> pd.DataFrame:
    """
    Deduplicate by LinkedIn URL (case-insensitive, primary key).
    
    Returns:
        DataFrame with duplicates removed, keeping first occurrence
    """
    if df.empty:
        return df
    
    df = df.copy()
    
    # Normalize LinkedIn URLs (lowercase, strip whitespace)
    df['linkedin_url_normalized'] = df['linkedin_url'].astype(str).str.lower().str.strip()
    
    # Drop duplicates by normalized URL, keeping first
    df_deduped = df.drop_duplicates(subset=['linkedin_url_normalized'], keep='first')
    
    # Drop the normalization column
    df_deduped = df_deduped.drop(columns=['linkedin_url_normalized'])
    
    return df_deduped.reset_index(drop=True)


def fuzzy_match_contacts(contact1: pd.Series, contact2: pd.Series, threshold: float = 92.0) -> bool:
    """
    Check if two contacts are fuzzy matches based on school + name.
    
    Args:
        contact1, contact2: pandas Series with 'school' and 'name' columns
        threshold: Similarity threshold (default 92.0)
    
    Returns:
        True if fuzzy match above threshold
    """
    # Create composite key: school + name
    key1 = f"{contact1.get('school', '')} {contact1.get('name', '')}".strip()
    key2 = f"{contact2.get('school', '')} {contact2.get('name', '')}".strip()
    
    if not key1 or not key2:
        return False
    
    ratio = fuzz.ratio(key1.lower(), key2.lower())
    return ratio >= threshold


def dedupe_fuzzy_match(df: pd.DataFrame, threshold: float = 92.0) -> pd.DataFrame:
    """
    Remove fuzzy duplicates based on school + name similarity.
    
    This is a secondary deduplication pass after LinkedIn URL deduplication.
    Keeps the contact with higher total_score if scores are available.
    
    Returns:
        DataFrame with fuzzy duplicates removed
    """
    if df.empty:
        return df
    
    df = df.copy()
    
    # Add a 'keep' column
    df['keep'] = True
    
    # If total_score exists, sort by it (descending) so we keep higher-scored contacts
    if 'total_score' in df.columns:
        df = df.sort_values('total_score', ascending=False)
    
    # Check each pair of contacts
    indices_to_drop = set()
    
    for i in range(len(df)):
        if i in indices_to_drop:
            continue
        
        contact1 = df.iloc[i]
        
        for j in range(i + 1, len(df)):
            if j in indices_to_drop:
                continue
            
            contact2 = df.iloc[j]
            
            if fuzzy_match_contacts(contact1, contact2, threshold):
                # Mark the second one for removal (since df is sorted by score if available)
                indices_to_drop.add(j)
    
    # Drop fuzzy duplicates
    df_deduped = df[~df.index.isin(indices_to_drop)].copy()
    df_deduped = df_deduped.drop(columns=['keep'])
    
    return df_deduped.reset_index(drop=True)


def dedupe_contacts(df: pd.DataFrame, fuzzy_threshold: float = 92.0) -> Tuple[pd.DataFrame, int]:
    """
    Full deduplication pipeline.
    
    Returns:
        Tuple of (deduplicated DataFrame, number of duplicates removed)
    """
    original_count = len(df)
    
    # Step 1: Deduplicate by LinkedIn URL
    df = dedupe_by_linkedin_url(df)
    
    # Step 2: Fuzzy match deduplication
    df = dedupe_fuzzy_match(df, fuzzy_threshold)
    
    duplicates_removed = original_count - len(df)
    
    return df, duplicates_removed
