import csv
import re
import sys
from typing import List, Tuple, Optional

def validate_email(email: str) -> bool:
    """
    Validate email format using regex pattern.
    Returns True if email is valid, False otherwise.
    """
    if not email or not isinstance(email, str):
        return False
    
    # Basic email regex pattern
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return re.match(pattern, email.strip()) is not None

def split_name(full_name: str) -> Tuple[str, str]:
    """
    Split full name into first and last name.
    Handles various name formats and edge cases.
    """
    if not full_name or not isinstance(full_name, str):
        return "", ""
    
    # Clean the name
    name = full_name.strip()
    
    # Split by spaces and filter out empty strings
    name_parts = [part.strip() for part in name.split() if part.strip()]
    
    if not name_parts:
        return "", ""
    elif len(name_parts) == 1:
        return name_parts[0], ""
    else:
        # First name is the first part, last name is everything else joined
        first_name = name_parts[0]
        last_name = " ".join(name_parts[1:])
        return first_name, last_name

def process_csv(input_file: str, output_file: str) -> Tuple[int, int]:
    """
    Process the input CSV file and create output CSV with valid email rows.
    
    Args:
        input_file: Path to input CSV file
        output_file: Path to output CSV file
    
    Returns:
        Tuple of (total_rows_processed, valid_rows_output)
    """
    total_rows = 0
    valid_rows = 0
    
    try:
        with open(input_file, 'r', newline='', encoding='utf-8') as infile, \
             open(output_file, 'w', newline='', encoding='utf-8') as outfile:
            
            # Read input CSV
            reader = csv.DictReader(infile)
            
            # Define output fieldnames
            fieldnames = ['First Name', 'Last Name', 'Major', 'School', 'Email']
            
            # Write output CSV header
            writer = csv.DictWriter(outfile, fieldnames=fieldnames)
            writer.writeheader()
            
            # Process each row
            for row in reader:
                total_rows += 1
                
                # Extract data from input row
                full_name = row.get('Name', '')
                major = row.get('Major', '')
                school = row.get('School', '')
                email = row.get('Email', '')
                
                # Split name
                first_name, last_name = split_name(full_name)
                
                # Validate email
                if validate_email(email):
                    # Write valid row to output file
                    output_row = {
                        'First Name': first_name,
                        'Last Name': last_name,
                        'Major': major,
                        'School': school,
                        'Email': email.strip()
                    }
                    writer.writerow(output_row)
                    valid_rows += 1
                else:
                    print(f"Warning: Invalid email '{email}' for {full_name}")
    
    except FileNotFoundError:
        print(f"Error: Input file '{input_file}' not found.")
        return 0, 0
    except Exception as e:
        print(f"Error processing file: {e}")
        return 0, 0
    
    return total_rows, valid_rows

def main():
    """
    Main function to run the CSV processing script.
    """
    if len(sys.argv) != 3:
        print("Usage: python process_graduation_data.py <input_file.csv> <output_file.csv>")
        print("Example: python process_graduation_data.py graduates.csv processed_graduates.csv")
        sys.exit(1)
    
    input_file = sys.argv[1]
    output_file = sys.argv[2]
    
    print(f"Processing {input_file}...")
    total_processed, valid_output = process_csv(input_file, output_file)
    
    if total_processed > 0:
        print(f"Processing complete!")
        print(f"Total rows processed: {total_processed}")
        print(f"Valid rows with emails: {valid_output}")
        print(f"Output saved to: {output_file}")
    else:
        print("No data was processed. Please check your input file.")

if __name__ == "__main__":
    main() 