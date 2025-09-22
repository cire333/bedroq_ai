from schematic_ingest import parse_schematic_with_paths;
import json

# Simple usage
# result = parse_schematic_with_paths('my_schematic.kicad_sch')

# With custom output path
result = parse_schematic_with_paths(
    input_file='schematic_inputs/connections.kicad_sch',
    output_file='schematic_outputs/connections.json'
)

# Access specific information
print(f"Found {len(result['components'])} components")
print(f"Found {len(result['nets'])} nets")
