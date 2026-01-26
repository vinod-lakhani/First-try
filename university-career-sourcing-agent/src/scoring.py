"""
Persona classification and scoring for contacts.
"""
from typing import Dict, Optional, List, Tuple
import pandas as pd
import json


def load_config_keywords(config_path: str = 'schools.json') -> Tuple[Dict[str, List[str]], Dict[str, List[str]]]:
    """
    Load persona keywords and seniority keywords from config file.
    
    Returns:
        Tuple of (persona_keywords dict, seniority_keywords dict)
    """
    try:
        with open(config_path, 'r') as f:
            config = json.load(f)
    except FileNotFoundError:
        # Fallback to defaults if config not found
        return get_default_keywords()
    
    title_keywords = config.get('title_keywords', [])
    role_seniority_keywords = config.get('role_seniority_keywords', [])
    
    # Map title keywords to personas
    persona_keywords = {
        'Employer Relations': [kw for kw in title_keywords if 'employer' in kw or 'corporate' in kw or 'industry' in kw or 'partnerships' in kw],
        'Career Services': [kw for kw in title_keywords if 'career' in kw or 'professional' in kw or 'student success' in kw],
        'Experiential Learning': [kw for kw in title_keywords if 'experiential' in kw or 'internship' in kw or 'co-op' in kw]
    }
    
    # If no keywords mapped, use defaults
    if not any(persona_keywords.values()):
        return get_default_keywords()
    
    # Map seniority keywords
    seniority_keywords = {
        'senior': [kw for kw in role_seniority_keywords if 'director' in kw or 'head' in kw or 'lead' in kw],
        'mid': [kw for kw in role_seniority_keywords if 'manager' in kw],
        'junior': ['assistant', 'intern', 'fellow', 'coordinator']
    }
    
    # Add defaults if needed
    if not seniority_keywords['senior']:
        seniority_keywords['senior'] = ['director', 'head', 'lead', 'chief', 'vp', 'vice president']
    if not seniority_keywords['mid']:
        seniority_keywords['mid'] = ['manager', 'coordinator', 'specialist', 'advisor', 'counselor']
    
    return persona_keywords, seniority_keywords


def get_default_keywords():
    """Return default keywords if config not available."""
    persona_keywords = {
        'Employer Relations': [
            'employer relations', 'employer partnerships', 'employer engagement',
            'employer services', 'corporate relations', 'recruiter relations',
            'employer outreach', 'partnerships', 'employer development', 'industry partnerships'
        ],
        'Career Services': [
            'career services', 'career center', 'career counseling',
            'career counselor', 'career advisor', 'career development',
            'career planning', 'career guidance', 'professional development', 'student success'
        ],
        'Experiential Learning': [
            'experiential learning', 'internship', 'co-op', 'cooperative education',
            'work-integrated learning', 'practicum', 'field experience',
            'experiential education', 'internships'
        ]
    }
    
    seniority_keywords = {
        'senior': ['director', 'senior director', 'associate director', 'executive director',
                   'head', 'chief', 'vice president', 'vp', 'dean', 'assistant dean', 'lead'],
        'mid': ['manager', 'coordinator', 'specialist', 'advisor', 'counselor',
                'associate', 'assistant director', 'program manager'],
        'junior': ['assistant', 'intern', 'fellow', 'associate', 'coordinator']
    }
    
    return persona_keywords, seniority_keywords


# Global keyword caches (loaded on first use)
_PERSONA_KEYWORDS = None
_SENIORITY_KEYWORDS = None


def get_persona_keywords(config_path: str = 'schools.json') -> Dict[str, List[str]]:
    """Get persona keywords, loading from config if needed."""
    global _PERSONA_KEYWORDS
    if _PERSONA_KEYWORDS is None:
        _PERSONA_KEYWORDS, _ = load_config_keywords(config_path)
    return _PERSONA_KEYWORDS


def get_seniority_keywords(config_path: str = 'schools.json') -> Dict[str, List[str]]:
    """Get seniority keywords, loading from config if needed."""
    global _SENIORITY_KEYWORDS
    if _SENIORITY_KEYWORDS is None:
        _, _SENIORITY_KEYWORDS = load_config_keywords(config_path)
    return _SENIORITY_KEYWORDS


def classify_persona(title: str, config_path: str = 'schools.json') -> str:
    """
    Classify contact into persona based on title.
    
    Returns:
        'Employer Relations', 'Career Services', 'Experiential Learning', or 'Unknown'
    """
    if pd.isna(title) or not title:
        return 'Unknown'
    
    title_lower = title.lower()
    persona_keywords = get_persona_keywords(config_path)
    
    # Count matches for each persona
    persona_scores = {}
    for persona, keywords in persona_keywords.items():
        score = sum(1 for keyword in keywords if keyword in title_lower)
        if score > 0:
            persona_scores[persona] = score
    
    if not persona_scores:
        return 'Unknown'
    
    # Return persona with highest score
    return max(persona_scores.items(), key=lambda x: x[1])[0]


def score_seniority(title: str, config_path: str = 'schools.json') -> float:
    """
    Score seniority based on title keywords.
    
    Returns:
        Float score: 3.0 (senior), 2.0 (mid), 1.0 (junior), 0.5 (unknown)
    """
    if pd.isna(title) or not title:
        return 0.5
    
    title_lower = title.lower()
    seniority_keywords = get_seniority_keywords(config_path)
    
    for level, keywords in seniority_keywords.items():
        if any(keyword in title_lower for keyword in keywords):
            if level == 'senior':
                return 3.0
            elif level == 'mid':
                return 2.0
            else:
                return 1.0
    
    return 0.5


def score_title_relevance(title: str, persona: str, config_path: str = 'schools.json') -> float:
    """
    Score how relevant the title is to the classified persona.
    
    Returns:
        Float score: 2.0 (perfect match), 1.5 (good match), 1.0 (partial), 0.5 (weak)
    """
    if pd.isna(title) or not title or persona == 'Unknown':
        return 0.5
    
    title_lower = title.lower()
    persona_keywords = get_persona_keywords(config_path)
    keywords = persona_keywords.get(persona, [])
    
    if not keywords:
        return 0.5
    
    # Count keyword matches
    matches = sum(1 for keyword in keywords if keyword in title_lower)
    
    if matches >= 2:
        return 2.0
    elif matches == 1:
        return 1.5
    elif any(kw in title_lower for kw in ['career', 'employer', 'learning']):
        return 1.0
    else:
        return 0.5


def calculate_contact_score(row: pd.Series, config_path: str = 'schools.json') -> float:
    """
    Calculate overall score for a contact.
    
    Formula: (seniority_score + title_relevance_score) / 2
    
    Returns:
        Float score between 0.5 and 2.5
    """
    seniority = score_seniority(row['title'], config_path)
    relevance = score_title_relevance(row['title'], row['persona'], config_path)
    return (seniority + relevance) / 2


def classify_and_score_contacts(df: pd.DataFrame, config_path: str = 'schools.json') -> pd.DataFrame:
    """
    Add persona classification and scoring to dataframe.
    
    Returns:
        DataFrame with added columns: persona, seniority_score, relevance_score, total_score
    """
    df = df.copy()
    
    df['persona'] = df['title'].apply(lambda x: classify_persona(x, config_path))
    df['seniority_score'] = df['title'].apply(lambda x: score_seniority(x, config_path))
    df['relevance_score'] = df.apply(
        lambda row: score_title_relevance(row['title'], row['persona'], config_path), axis=1
    )
    df['total_score'] = df.apply(lambda row: calculate_contact_score(row, config_path), axis=1)
    
    return df
