"""
Generate persona-based outreach drafts (email + LinkedIn notes).
"""
import pandas as pd
from typing import Dict, List


# Outreach templates by persona
TEMPLATES = {
    'Employer Relations': {
        'email_subject': 'Partner with [SCHOOL] to support student career success',
        'email_body': """Hi {name},

I hope this email finds you well. I'm reaching out because I noticed your role in Employer Relations at {school}.

We've built [OFFER] - a resource designed to help students better prepare for employer partnerships and career opportunities. I believe this could be valuable for the employers you work with and the students they recruit.

Would you be open to a brief conversation about how we might collaborate to support your employer partners and enhance your students' career readiness?

Best regards,
[Your Name]""",
        'linkedin_note': """Hi {name}, I'd love to connect and discuss how [OFFER] could support employer partners at {school}. Would you be open to a quick conversation? Best, [Your Name]"""
    },
    'Career Services': {
        'email_subject': 'Supporting {school} students with [OFFER]',
        'email_body': """Hi {name},

I hope you're having a great week. I'm reaching out because of your work in Career Services at {school}.

We've developed [OFFER] - a tool that helps students better understand their career options and prepare for their professional journey. I thought this might complement the resources you already provide to students.

I'd love to learn more about the challenges you see students facing and explore if [OFFER] could be a helpful addition to your toolkit.

Would you be interested in a brief call to discuss?

Best regards,
[Your Name]""",
        'linkedin_note': """Hi {name}, I'd love to connect about [OFFER] - a student resource tool that might support Career Services at {school}. Open to a quick chat? Best, [Your Name]"""
    },
    'Experiential Learning': {
        'email_subject': 'Enhancing experiential learning outcomes at {school}',
        'email_body': """Hi {name},

I hope this message finds you well. I noticed your role in Experiential Learning at {school}.

We've created [OFFER] - a resource that helps students prepare for and reflect on their experiential learning opportunities. This could potentially enhance the outcomes for students in internships, co-ops, and other experiential programs.

I'd be grateful for an opportunity to discuss how [OFFER] might support your programs and the students you serve.

Would you be available for a brief conversation?

Best regards,
[Your Name]""",
        'linkedin_note': """Hi {name}, I'd like to connect about [OFFER] - a tool for experiential learning at {school}. Would you be open to a quick conversation? Best, [Your Name]"""
    },
    'Unknown': {
        'email_subject': 'Supporting career development at {school}',
        'email_body': """Hi {name},

I hope this email finds you well. I'm reaching out because of your role at {school}'s career services team.

We've developed [OFFER] - a resource designed to support student career development and readiness. I thought this might be relevant to your work.

Would you be open to a brief conversation about how we might collaborate?

Best regards,
[Your Name]""",
        'linkedin_note': """Hi {name}, I'd like to connect about [OFFER] for {school}'s career services. Open to a quick chat? Best, [Your Name]"""
    }
}


def truncate_linkedin_note(note: str, max_length: int = 300) -> str:
    """
    Truncate LinkedIn note to max_length characters, respecting word boundaries.
    """
    if len(note) <= max_length:
        return note
    
    # Truncate and find last space before max_length
    truncated = note[:max_length]
    last_space = truncated.rfind(' ')
    
    if last_space > max_length * 0.8:  # If last space is reasonably close
        truncated = truncated[:last_space]
    
    return truncated + '...' if truncated != note else truncated


def generate_outreach_drafts(df: pd.DataFrame, offer: str = "[OFFER]") -> str:
    """
    Generate outreach drafts (email + LinkedIn notes) for all contacts.
    
    Args:
        df: DataFrame with contacts (must have: name, school, persona)
        offer: The offer/product description to insert into templates
    
    Returns:
        Markdown string with all outreach drafts
    """
    if df.empty:
        return "# Outreach Drafts\n\nNo contacts to generate drafts for.\n"
    
    # Sort by score (descending) if available, else by name
    if 'total_score' in df.columns:
        df_sorted = df.sort_values('total_score', ascending=False)
    else:
        df_sorted = df.sort_values('name')
    
    output = ["# Outreach Drafts\n"]
    output.append(f"*Generated for {len(df_sorted)} contacts*\n")
    output.append(f"*Offer/Product: {offer}*\n")
    output.append("---\n\n")
    
    for idx, row in df_sorted.iterrows():
        name = row.get('name', 'Contact')
        school = row.get('school', 'University')
        persona = row.get('persona', 'Unknown')
        title = row.get('title', '')
        linkedin_url = row.get('linkedin_url', '')
        
        # Get template for persona (default to Unknown if persona not in templates)
        template = TEMPLATES.get(persona, TEMPLATES['Unknown'])
        
        # Format templates
        email_subject = template['email_subject'].format(name=name, school=school, OFFER=offer)
        email_body = template['email_body'].format(name=name, school=school, OFFER=offer)
        linkedin_note_raw = template['linkedin_note'].format(name=name, school=school, OFFER=offer)
        linkedin_note = truncate_linkedin_note(linkedin_note_raw, max_length=300)
        
        # Add score if available
        score_section = ""
        if 'total_score' in row and pd.notna(row['total_score']):
            score_section = f" (Score: {row['total_score']:.2f})"
        
        output.append(f"## {name}{score_section}\n")
        output.append(f"**School:** {school}  \n")
        output.append(f"**Title:** {title}  \n")
        output.append(f"**Persona:** {persona}  \n")
        if linkedin_url:
            output.append(f"**LinkedIn:** {linkedin_url}  \n")
        output.append("\n")
        
        output.append("### Email\n")
        output.append(f"**Subject:** {email_subject}\n\n")
        output.append(f"**Body:**\n```\n{email_body}\n```\n\n")
        
        output.append("### LinkedIn Connection Note\n")
        output.append(f"```\n{linkedin_note}\n```\n\n")
        
        output.append("---\n\n")
    
    return ''.join(output)
