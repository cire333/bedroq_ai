import json
import os

def clean_json_data(data):
    """
    Recursively clean JSON data by removing specified blocks according to the rules:
    1. Remove all "effects" blocks
    2. Remove all "font" blocks
    3. Remove all "justify" blocks
    4. Remove all "graphics" blocks
    5. Remove "Datasheet" blocks if name="Datasheet" and (value="~" or value="")
    """
    if isinstance(data, dict):
        # Create a new dictionary to avoid modifying during iteration
        cleaned_data = {}
        
        for key, value in data.items():
            # Skip these keys entirely
            if key in ['effects', 'font', 'justify', 'graphics']:
                continue
                
            # Special handling for Datasheet blocks
            if key == 'Datasheet' and isinstance(value, dict):
                # Check if this is a Datasheet block with the removal criteria
                name_matches = value.get('name') == 'Datasheet'
                value_empty = value.get('value') in ['', '~']
                
                if name_matches and value_empty:
                    print(f"Removing Datasheet block with value: '{value.get('value')}'")
                    continue  # Skip this Datasheet block
            
            # Recursively clean the value
            cleaned_data[key] = clean_json_data(value)
            
        return cleaned_data
    
    elif isinstance(data, list):
        # Recursively clean each item in the list
        return [clean_json_data(item) for item in data]
    
    else:
        # Return primitive values as-is (strings, numbers, booleans, None)
        return data

def process_json_file(input_file, output_file=None):
    """
    Process a JSON file and save the cleaned version
    
    Args:
        input_file (str): Path to the input JSON file
        output_file (str, optional): Path to the output file. If None, creates a "_cleaned" version
    """
    try:
        # Generate output filename if not provided
        if output_file is None:
            name, ext = os.path.splitext(input_file)
            output_file = f"{name}_cleaned{ext}"
        
        # Read the JSON file
        with open(input_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        print(f"Loaded JSON data from {input_file}")
        
        # Clean the data
        cleaned_data = clean_json_data(data)
        
        # Write the cleaned data to output file
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(cleaned_data, f, indent=2, ensure_ascii=False)
        
        print(f"Successfully processed {input_file} -> {output_file}")
        return True
        
    except FileNotFoundError:
        print(f"Error: File {input_file} not found.")
        return False
    except json.JSONDecodeError as e:
        print(f"Error: Invalid JSON format in {input_file}: {e}")
        return False
    except Exception as e:
        print(f"Error processing file: {e}")
        return False

def process_json_string(json_string):
    """
    Process a JSON string and return the cleaned version
    
    Args:
        json_string (str): JSON data as a string
        
    Returns:
        str: Cleaned JSON string
    """
    try:
        data = json.loads(json_string)
        cleaned_data = clean_json_data(data)
        return json.dumps(cleaned_data, indent=2, ensure_ascii=False)
    except json.JSONDecodeError as e:
        print(f"Error: Invalid JSON format: {e}")
        return None

# Example usage and testing
if __name__ == "__main__":
    # Example 1: Process a file
    input_filename = "connections-1.json"  # Replace with your actual file path
    ouput_filename = input_filename + "_clean"  # or specify a custom output file path
    
    if os.path.exists(input_filename):
        # process_json_file(input_filename)
        process_json_file(input_filename, output_file='connections-1_cleaned.json')
    else:
        print(f"File {input_filename} not found.")
