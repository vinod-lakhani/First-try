"""
Main CLI entry point for the University Career Contacts Sourcing Agent.
"""
import argparse
import json
import os
import sys
import pandas as pd
from pathlib import Path

from queries import print_query_packs
from scoring import classify_and_score_contacts
from dedupe import dedupe_contacts
from enrich import enrich_contacts_from_staff_pages
from outreach import generate_outreach_drafts


def ensure_output_dir():
    """Create outputs/ directory if it doesn't exist."""
    output_dir = Path('outputs')
    output_dir.mkdir(exist_ok=True)
    return output_dir


def run_queries_command(config_path: str):
    """Generate and print query packs."""
    print("\n" + "="*80)
    print("UNIVERSITY CAREER CONTACTS SOURCING AGENT - QUERY PACKS")
    print("="*80)
    print("\nThis tool generates search queries for manual use.")
    print("Copy and paste these queries into Google, LinkedIn, or your search engine of choice.\n")
    
    try:
        print_query_packs(config_path)
    except FileNotFoundError:
        print(f"Error: Config file not found: {config_path}")
        sys.exit(1)
    except json.JSONDecodeError as e:
        print(f"Error: Invalid JSON in config file: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)


def run_main_command(
    input_path: str,
    config_path: str,
    staff_pages_path: str,
    offer: str
):
    """Run the main agent pipeline."""
    print("\n" + "="*80)
    print("UNIVERSITY CAREER CONTACTS SOURCING AGENT")
    print("="*80 + "\n")
    
    # Ensure output directory exists
    output_dir = ensure_output_dir()
    
    # Load input CSV
    print(f"📥 Loading contacts from: {input_path}")
    try:
        df = pd.read_csv(input_path)
        print(f"   Loaded {len(df)} contacts\n")
    except FileNotFoundError:
        print(f"Error: Input file not found: {input_path}")
        sys.exit(1)
    except Exception as e:
        print(f"Error loading CSV: {e}")
        sys.exit(1)
    
    # Validate required columns
    required_cols = ['school', 'name', 'title', 'linkedin_url']
    missing_cols = [col for col in required_cols if col not in df.columns]
    if missing_cols:
        print(f"Error: Missing required columns: {missing_cols}")
        sys.exit(1)
    
    # Step 1: Classify and score
    print("🎯 Classifying personas and scoring contacts...")
    df = classify_and_score_contacts(df, config_path=config_path)
    print(f"   Personas classified\n")
    
    # Step 2: Deduplicate
    print("🔄 Deduplicating contacts...")
    original_count = len(df)
    df, duplicates_removed = dedupe_contacts(df, fuzzy_threshold=92.0)
    print(f"   Removed {duplicates_removed} duplicates ({original_count} -> {len(df)})\n")
    
    # Step 3: Enrich (if staff pages provided)
    if os.path.exists(staff_pages_path):
        print(f"📧 Enriching contacts from staff pages: {staff_pages_path}")
        df = enrich_contacts_from_staff_pages(df, staff_pages_path)
        print(f"   Enrichment complete\n")
    else:
        print(f"⚠️  Staff pages file not found: {staff_pages_path}")
        print("   Skipping enrichment\n")
    
    # Step 4: Generate outputs
    print("📄 Generating output files...")
    
    # Save contacts CSV
    contacts_output = output_dir / 'contacts.csv'
    df_output = df.copy()
    
    # Select columns for output (in order)
    output_cols = ['school', 'name', 'title', 'persona', 'total_score', 
                   'seniority_score', 'relevance_score', 'linkedin_url']
    
    # Add email/phone if they exist
    if 'email' in df_output.columns:
        output_cols.append('email')
    if 'phone' in df_output.columns:
        output_cols.append('phone')
    
    # Only include columns that exist
    output_cols = [col for col in output_cols if col in df_output.columns]
    
    df_output[output_cols].to_csv(contacts_output, index=False)
    print(f"   ✓ Saved: {contacts_output}")
    
    # Generate outreach drafts
    drafts_output = output_dir / 'outreach_drafts.md'
    drafts_content = generate_outreach_drafts(df, offer=offer)
    with open(drafts_output, 'w') as f:
        f.write(drafts_content)
    print(f"   ✓ Saved: {drafts_output}\n")
    
    # Print summary statistics
    print("📊 SUMMARY STATISTICS")
    print("="*80)
    print(f"Total input rows:       {original_count}")
    print(f"Deduplicated count:     {len(df)}")
    print(f"Duplicates removed:     {duplicates_removed}\n")
    
    print("Counts by persona:")
    persona_counts = df['persona'].value_counts()
    for persona, count in persona_counts.items():
        print(f"  {persona:25s} {count:4d}")
    print()
    
    if 'total_score' in df.columns:
        print("Top 10 contacts by score:")
        top_10 = df.nlargest(10, 'total_score')[['name', 'school', 'title', 'persona', 'total_score']]
        for idx, row in top_10.iterrows():
            print(f"  {row['name']:20s} | {row['school']:15s} | {row['persona']:20s} | Score: {row['total_score']:.2f}")
    
    print("\n" + "="*80)
    print("✅ Processing complete!")
    print("="*80 + "\n")


def main():
    """Main CLI entry point."""
    parser = argparse.ArgumentParser(
        description='University Career Contacts Sourcing Agent',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Generate query packs
  python src/agent.py queries --config schools.json

  # Process contacts
  python src/agent.py run --input sample_input_contacts.csv --config schools.json --staff staff_pages.json --offer "WeLeap career planning tool"
        """
    )
    
    subparsers = parser.add_subparsers(dest='command', help='Command to run')
    
    # Queries command
    queries_parser = subparsers.add_parser('queries', help='Generate query packs')
    queries_parser.add_argument('--config', required=True, help='Path to schools.json config file')
    
    # Run command
    run_parser = subparsers.add_parser('run', help='Run the agent pipeline')
    run_parser.add_argument('--input', required=True, help='Path to input CSV file')
    run_parser.add_argument('--config', required=True, help='Path to schools.json config file')
    run_parser.add_argument('--staff', required=True, help='Path to staff_pages.json file')
    run_parser.add_argument('--offer', required=True, help='Product/offer description for outreach templates')
    
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        sys.exit(1)
    
    if args.command == 'queries':
        run_queries_command(args.config)
    elif args.command == 'run':
        run_main_command(args.input, args.config, args.staff, args.offer)
    else:
        parser.print_help()
        sys.exit(1)


if __name__ == '__main__':
    main()
