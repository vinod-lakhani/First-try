"""
Query pack generation for manual LinkedIn and web searches.
Generates copy-paste ready queries for each school.
"""
import json
from typing import Dict, List


def generate_query_packs(config_path: str) -> Dict[str, Dict[str, List[str]]]:
    """
    Generate query packs for each school in the config.
    
    Returns:
        Dict mapping school short codes to query packs with:
        - google_linkedin: Google site:linkedin.com queries
        - linkedin_keywords: Suggested LinkedIn keyword searches
        - staff_searches: Suggested staff page search queries
    """
    with open(config_path, 'r') as f:
        config = json.load(f)
    
    schools = config.get('schools', [])
    title_keywords = config.get('title_keywords', [])
    
    query_packs = {}
    
    for school_data in schools:
        school_name = school_data['name']
        school_short = school_data['short']
        domain = school_data.get('domain', '')
        
        # Google site:linkedin.com queries using title keywords
        google_linkedin = []
        for keyword in title_keywords[:5]:  # Use first 5 keywords
            google_linkedin.append(f'site:linkedin.com "{school_name}" "{keyword.title()}"')
        
        # LinkedIn keyword searches (to be done manually in LinkedIn search)
        linkedin_keywords = []
        for keyword in title_keywords[:5]:  # Use first 5 keywords
            linkedin_keywords.append(f'"{school_name}" AND "{keyword.title()}"')
        
        # Staff page search suggestions
        staff_searches = []
        if domain:
            for keyword in title_keywords[:4]:  # Use first 4 keywords
                staff_searches.append(f'site:{domain} "{keyword.title()}"')
        else:
            # Fallback to using school name if no domain
            for keyword in title_keywords[:4]:
                staff_searches.append(f'"{school_name}" "{keyword.title()}" staff')
        
        query_packs[school_short] = {
            'google_linkedin': google_linkedin,
            'linkedin_keywords': linkedin_keywords,
            'staff_searches': staff_searches
        }
    
    return query_packs


def print_query_packs(config_path: str):
    """Print formatted query packs for all schools."""
    query_packs = generate_query_packs(config_path)
    
    for school_short, packs in query_packs.items():
        print(f"\n{'='*80}")
        print(f"SCHOOL: {school_short}")
        print(f"{'='*80}\n")
        
        print("📊 GOOGLE SITE:LINKEDIN.COM QUERIES:")
        print("   (Copy these into Google search)")
        for i, query in enumerate(packs['google_linkedin'], 1):
            print(f"   {i}. {query}")
        
        print("\n🔗 LINKEDIN KEYWORD SEARCHES:")
        print("   (Use these in LinkedIn's search bar)")
        for i, query in enumerate(packs['linkedin_keywords'], 1):
            print(f"   {i}. {query}")
        
        print("\n🌐 STAFF PAGE SEARCHES:")
        print("   (Use these to find official university staff directories)")
        for i, query in enumerate(packs['staff_searches'], 1):
            print(f"   {i}. {query}")
        
        print()
