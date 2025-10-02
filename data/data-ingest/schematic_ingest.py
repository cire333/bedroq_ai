#!/usr/bin/env python3
"""
KiCad Schematic (.kicad_sch) Parser
Converts KiCad schematic files to JSON while preserving circuit connectivity and relationships.
"""

import json
import re
from typing import Dict, List, Any, Tuple, Optional
from dataclasses import dataclass, asdict
from collections import defaultdict
import math
import time
from pathlib import Path
from dotenv import load_dotenv

# Load variables from env.dev file
load_dotenv("env.dev")


# Parser version
PARSER_VERSION = "1.0.0"

@dataclass
class Point:
    x: float
    y: float
    
    def distance_to(self, other: 'Point') -> float:
        return math.sqrt((self.x - other.x)**2 + (self.y - other.y)**2)

@dataclass
class Pin:
    number: str
    name: str
    type: str
    position: Point
    orientation: float = 0
    length: float = 0
    
@dataclass
class Component:
    reference: str
    value: str
    footprint: str
    position: Point
    rotation: float
    library_id: str
    pins: Dict[str, Pin]
    properties: Dict[str, Any]

@dataclass
class Wire:
    start: Point
    end: Point
    
@dataclass
class Junction:
    position: Point
    
@dataclass
class Label:
    text: str
    position: Point
    rotation: float = 0
    type: str = "label"  # label, hierarchical_label, etc.

@dataclass
class Net:
    name: str
    pins: List[Tuple[str, str]]  # (component_ref, pin_number)
    wires: List[Wire]
    junctions: List[Junction]
    labels: List[Label]

class SExprParser:
    """Simple S-expression parser for KiCad files"""
    
    def __init__(self, text: str):
        self.text = text
        self.pos = 0
        
    def parse(self) -> Any:
        self.skip_whitespace()
        if self.pos >= len(self.text):
            return None
        
        if self.text[self.pos] == '(':
            return self.parse_list()
        else:
            return self.parse_atom()
    
    def parse_list(self) -> List[Any]:
        self.expect('(')
        result = []
        
        while True:
            self.skip_whitespace()
            if self.pos >= len(self.text):
                raise ValueError("Unexpected end of input")
            
            if self.text[self.pos] == ')':
                self.pos += 1
                break
                
            result.append(self.parse())
        
        return result
    
    def parse_atom(self) -> str:
        if self.text[self.pos] == '"':
            return self.parse_string()
        else:
            return self.parse_bare_atom()
    
    def parse_string(self) -> str:
        self.expect('"')
        start = self.pos
        
        while self.pos < len(self.text) and self.text[self.pos] != '"':
            if self.text[self.pos] == '\\':
                self.pos += 2  # Skip escaped character
            else:
                self.pos += 1
                
        if self.pos >= len(self.text):
            raise ValueError("Unterminated string")
            
        result = self.text[start:self.pos]
        self.expect('"')
        return result
    
    def parse_bare_atom(self) -> str:
        start = self.pos
        
        while (self.pos < len(self.text) and 
               self.text[self.pos] not in ' \t\n\r()'):
            self.pos += 1
            
        return self.text[start:self.pos]
    
    def skip_whitespace(self):
        while (self.pos < len(self.text) and 
               self.text[self.pos] in ' \t\n\r'):
            self.pos += 1
    
    def expect(self, char: str):
        if self.pos >= len(self.text) or self.text[self.pos] != char:
            raise ValueError(f"Expected '{char}' at position {self.pos}")
        self.pos += 1

class KiCadSchematicParser:
    """Parser for KiCad schematic files"""
    
    def __init__(self):
        self.components: Dict[str, Component] = {}
        self.nets: Dict[str, Net] = {}
        self.lib_symbols: Dict[str, Dict] = {}
        self.wires: List[Wire] = []
        self.junctions: List[Junction] = []
        self.labels: List[Label] = []
        self.metadata: Dict[str, Any] = {}
        
    def parse_file(self, filename: str) -> Dict[str, Any]:
        """Parse a KiCad schematic file and return JSON-serializable dict"""
        with open(filename, 'r', encoding='utf-8') as f:
            content = f.read()
        
        parser = SExprParser(content)
        data = parser.parse()
        
        if not data or data[0] != 'kicad_sch':
            raise ValueError("Not a valid KiCad schematic file")
        
        self._parse_schematic(data)
        self._build_nets()
        
        # Get original filename for metadata
        original_filename = Path(filename).name
        
        return self._to_dict(original_filename)
    
    def _parse_schematic(self, data: List[Any]):
        """Parse the main schematic data structure"""
        for item in data[1:]:  # Skip 'kicad_sch'
            if not isinstance(item, list) or not item:
                continue
                
            cmd = item[0]
            
            if cmd == 'version':
                self.metadata['version'] = item[1]
            elif cmd == 'generator':
                self.metadata['generator'] = item[1]
            elif cmd == 'generator_version':
                self.metadata['generator_version'] = item[1]
            elif cmd == 'uuid':
                self.metadata['uuid'] = item[1]
            elif cmd == 'paper':
                self.metadata['paper'] = item[1]
            elif cmd == 'title_block':
                self.metadata['title_block'] = self._parse_title_block(item)
            elif cmd == 'lib_symbols':
                self._parse_lib_symbols(item)
            elif cmd == 'wire':
                self.wires.append(self._parse_wire(item))
            elif cmd == 'junction':
                self.junctions.append(self._parse_junction(item))
            elif cmd == 'label':
                self.labels.append(self._parse_label(item, 'label'))
            elif cmd == 'hierarchical_label':
                self.labels.append(self._parse_label(item, 'hierarchical_label'))
            elif cmd == 'symbol':
                comp = self._parse_symbol(item)
                if comp:
                    self.components[comp.reference] = comp
            elif cmd == 'text':
                # Store text annotations
                text_info = self._parse_text(item)
                if 'text_annotations' not in self.metadata:
                    self.metadata['text_annotations'] = []
                self.metadata['text_annotations'].append(text_info)
    
    def _parse_title_block(self, item: List[Any]) -> Dict[str, Any]:
        """Parse title block information"""
        title_block = {}
        for subitem in item[1:]:
            if isinstance(subitem, list) and len(subitem) >= 2:
                title_block[subitem[0]] = subitem[1]
        return title_block
    
    def _parse_lib_symbols(self, item: List[Any]):
        """Parse library symbol definitions"""
        for subitem in item[1:]:
            if isinstance(subitem, list) and subitem[0] == 'symbol':
                symbol_data = self._parse_lib_symbol(subitem)
                if symbol_data:
                    self.lib_symbols[symbol_data['id']] = symbol_data
    
    def _parse_lib_symbol(self, item: List[Any]) -> Optional[Dict[str, Any]]:
        """Parse a single library symbol definition"""
        if len(item) < 2:
            return None
            
        symbol_id = item[1]
        symbol_data = {
            'id': symbol_id,
            'pins': {},
            'properties': {},
            'graphics': []
        }
        
        for subitem in item[2:]:
            if not isinstance(subitem, list):
                continue
                
            if subitem[0] == 'pin':
                pin_data = self._parse_lib_pin(subitem)
                if pin_data:
                    symbol_data['pins'][pin_data['number']] = pin_data
            elif subitem[0] == 'property':
                prop = self._parse_property(subitem)
                if prop:
                    symbol_data['properties'][prop['name']] = prop
            elif subitem[0] in ['symbol', 'polyline', 'rectangle', 'circle', 'arc']:
                # Store graphical elements
                symbol_data['graphics'].append(self._parse_graphics(subitem))
        
        return symbol_data
    
    def _parse_lib_pin(self, item: List[Any]) -> Optional[Dict[str, Any]]:
        """Parse a pin definition from library symbol"""
        if len(item) < 4:
            return None
            
        pin_data = {
            'type': item[1],  # input, output, bidirectional, etc.
            'shape': item[2],  # line, etc.
            'number': '',
            'name': '',
            'position': {'x': 0, 'y': 0},
            'length': 0,
            'orientation': 0
        }
        
        for subitem in item[3:]:
            if not isinstance(subitem, list):
                continue
                
            if subitem[0] == 'at':
                pin_data['position'] = {'x': float(subitem[1]), 'y': float(subitem[2])}
                if len(subitem) > 3:
                    pin_data['orientation'] = float(subitem[3])
            elif subitem[0] == 'length':
                pin_data['length'] = float(subitem[1])
            elif subitem[0] == 'name':
                pin_data['name'] = subitem[1]
            elif subitem[0] == 'number':
                pin_data['number'] = subitem[1]
        
        return pin_data
    
    def _parse_wire(self, item: List[Any]) -> Wire:
        """Parse a wire connection"""
        pts = []
        for subitem in item[1:]:
            if isinstance(subitem, list) and subitem[0] == 'pts':
                for pt_item in subitem[1:]:
                    if isinstance(pt_item, list) and pt_item[0] == 'xy':
                        pts.append(Point(float(pt_item[1]), float(pt_item[2])))
        
        if len(pts) >= 2:
            return Wire(pts[0], pts[1])
        else:
            return Wire(Point(0, 0), Point(0, 0))
    
    def _parse_junction(self, item: List[Any]) -> Junction:
        """Parse a junction point"""
        pos = Point(0, 0)
        for subitem in item[1:]:
            if isinstance(subitem, list) and subitem[0] == 'at':
                pos = Point(float(subitem[1]), float(subitem[2]))
        return Junction(pos)
    
    def _parse_label(self, item: List[Any], label_type: str) -> Label:
        """Parse a label or hierarchical label"""
        text = item[1] if len(item) > 1 else ""
        pos = Point(0, 0)
        rotation = 0
        
        for subitem in item[2:]:
            if isinstance(subitem, list):
                if subitem[0] == 'at':
                    pos = Point(float(subitem[1]), float(subitem[2]))
                    if len(subitem) > 3:
                        rotation = float(subitem[3])
        
        return Label(text, pos, rotation, label_type)
    
    def _parse_symbol(self, item: List[Any]) -> Optional[Component]:
        """Parse a component symbol instance"""
        if len(item) < 3:
            return None
            
        lib_id = item[1]
        pos = Point(0, 0)
        rotation = 0
        properties = {}
        pins = {}
        
        for subitem in item[2:]:
            if not isinstance(subitem, list):
                continue
                
            if subitem[0] == 'at':
                pos = Point(float(subitem[1]), float(subitem[2]))
                if len(subitem) > 3:
                    rotation = float(subitem[3])
            elif subitem[0] == 'property':
                prop = self._parse_property(subitem)
                if prop:
                    properties[prop['name']] = prop
            elif subitem[0] == 'pin':
                pin = self._parse_pin(subitem)
                if pin:
                    pins[pin.number] = pin
        
        # Extract key properties
        reference = properties.get('Reference', {}).get('value', '')
        value = properties.get('Value', {}).get('value', '')
        footprint = properties.get('Footprint', {}).get('value', '')
        
        if not reference:
            return None
            
        return Component(
            reference=reference,
            value=value,
            footprint=footprint,
            position=pos,
            rotation=rotation,
            library_id=lib_id,
            pins=pins,
            properties=properties
        )
    
    def _parse_property(self, item: List[Any]) -> Optional[Dict[str, Any]]:
        """Parse a property definition"""
        if len(item) < 3:
            return None
            
        prop_data = {
            'name': item[1],
            'value': item[2],
            'position': {'x': 0, 'y': 0},
            'rotation': 0,
            'effects': {}
        }
        
        for subitem in item[3:]:
            if isinstance(subitem, list):
                if subitem[0] == 'at':
                    prop_data['position'] = {'x': float(subitem[1]), 'y': float(subitem[2])}
                    if len(subitem) > 3:
                        prop_data['rotation'] = float(subitem[3])
                elif subitem[0] == 'effects':
                    prop_data['effects'] = self._parse_effects(subitem)
        
        return prop_data
    
    def _parse_pin(self, item: List[Any]) -> Optional[Pin]:
        """Parse a pin instance"""
        if len(item) < 3:
            return None
            
        pin_type = item[1]
        pin_shape = item[2]
        pos = Point(0, 0)
        length = 0
        name = ""
        number = ""
        
        for subitem in item[3:]:
            if isinstance(subitem, list):
                if subitem[0] == 'at':
                    pos = Point(float(subitem[1]), float(subitem[2]))
                elif subitem[0] == 'length':
                    length = float(subitem[1])
                elif subitem[0] == 'name':
                    name = subitem[1]
                elif subitem[0] == 'number':
                    number = subitem[1]
        
        return Pin(number, name, pin_type, pos, 0, length)
    
    def _parse_effects(self, item: List[Any]) -> Dict[str, Any]:
        """Parse effects (font, justification, etc.)"""
        effects = {}
        for subitem in item[1:]:
            if isinstance(subitem, list):
                effects[subitem[0]] = subitem[1:] if len(subitem) > 2 else subitem[1]
        return effects
    
    def _parse_text(self, item: List[Any]) -> Dict[str, Any]:
        """Parse text annotation"""
        text_data = {
            'text': item[1] if len(item) > 1 else "",
            'position': {'x': 0, 'y': 0},
            'rotation': 0,
            'effects': {}
        }
        
        for subitem in item[2:]:
            if isinstance(subitem, list):
                if subitem[0] == 'at':
                    text_data['position'] = {'x': float(subitem[1]), 'y': float(subitem[2])}
                    if len(subitem) > 3:
                        text_data['rotation'] = float(subitem[3])
                elif subitem[0] == 'effects':
                    text_data['effects'] = self._parse_effects(subitem)
        
        return text_data
    
    def _parse_graphics(self, item: List[Any]) -> Dict[str, Any]:
        """Parse graphical elements"""
        return {'type': item[0], 'data': item[1:]}
    
    def _build_nets(self):
        """Build net connectivity from wires, junctions, and labels"""
        # Group wires by connected endpoints
        wire_groups = []
        tolerance = 0.01  # Tolerance for coordinate matching
        
        for wire in self.wires:
            # Find if this wire connects to any existing groups
            connected_groups = []
            for i, group in enumerate(wire_groups):
                for existing_wire in group:
                    if (self._points_close(wire.start, existing_wire.start, tolerance) or
                        self._points_close(wire.start, existing_wire.end, tolerance) or
                        self._points_close(wire.end, existing_wire.start, tolerance) or
                        self._points_close(wire.end, existing_wire.end, tolerance)):
                        connected_groups.append(i)
                        break
            
            if not connected_groups:
                # Create new group
                wire_groups.append([wire])
            elif len(connected_groups) == 1:
                # Add to existing group
                wire_groups[connected_groups[0]].append(wire)
            else:
                # Merge multiple groups
                merged_group = [wire]
                for group_idx in sorted(connected_groups, reverse=True):
                    merged_group.extend(wire_groups[group_idx])
                    del wire_groups[group_idx]
                wire_groups.append(merged_group)
        
        # Create nets from wire groups
        for i, wire_group in enumerate(wire_groups):
            net_name = f"Net_{i}"
            
            # Find labels that belong to this net
            net_labels = []
            for label in self.labels:
                for wire in wire_group:
                    if (self._points_close(label.position, wire.start, tolerance) or
                        self._points_close(label.position, wire.end, tolerance)):
                        net_labels.append(label)
                        if label.text and not net_name.startswith("Net_"):
                            net_name = label.text
                        break
            
            # Find junctions that belong to this net
            net_junctions = []
            for junction in self.junctions:
                for wire in wire_group:
                    if (self._points_close(junction.position, wire.start, tolerance) or
                        self._points_close(junction.position, wire.end, tolerance)):
                        net_junctions.append(junction)
                        break
            
            # Find pins that connect to this net
            net_pins = []
            for comp_ref, component in self.components.items():
                for pin_num, pin in component.pins.items():
                    pin_pos = Point(
                        component.position.x + pin.position.x,
                        component.position.y + pin.position.y
                    )
                    
                    for wire in wire_group:
                        if (self._points_close(pin_pos, wire.start, tolerance) or
                            self._points_close(pin_pos, wire.end, tolerance)):
                            net_pins.append((comp_ref, pin_num))
                            break
            
            if net_pins or wire_group:  # Only create net if it has connections
                self.nets[net_name] = Net(
                    name=net_name,
                    pins=net_pins,
                    wires=wire_group,
                    junctions=net_junctions,
                    labels=net_labels
                )
    
    def _points_close(self, p1: Point, p2: Point, tolerance: float) -> bool:
        """Check if two points are within tolerance distance"""
        return p1.distance_to(p2) <= tolerance
    
    def _to_dict(self, original_filename: str) -> Dict[str, Any]:
        """Convert parsed data to JSON-serializable dictionary"""
        # Get current unix timestamp
        parse_timestamp = int(time.time())
        
        return {
            'bedroq-meta': {
                'parser_version': PARSER_VERSION,
                'original_filename': original_filename,
                'parsed_date_unix': parse_timestamp,
                'parsed_date_readable': time.strftime('%Y-%m-%d %H:%M:%S UTC', time.gmtime(parse_timestamp))
            },
            'metadata': self.metadata,
            'library_symbols': self.lib_symbols,
            'components': {ref: {
                'reference': comp.reference,
                'value': comp.value,
                'footprint': comp.footprint,
                'position': asdict(comp.position),
                'rotation': comp.rotation,
                'library_id': comp.library_id,
                'pins': {num: asdict(pin) for num, pin in comp.pins.items()},
                'properties': comp.properties
            } for ref, comp in self.components.items()},
            'nets': {name: {
                'name': net.name,
                'pins': net.pins,
                'wires': [{'start': asdict(w.start), 'end': asdict(w.end)} for w in net.wires],
                'junctions': [asdict(j.position) for j in net.junctions],
                'labels': [asdict(l) for l in net.labels]
            } for name, net in self.nets.items()},
            'wires': [{'start': asdict(w.start), 'end': asdict(w.end)} for w in self.wires],
            'junctions': [asdict(j.position) for j in self.junctions],
            'labels': [asdict(l) for l in self.labels]
        }

def main():
    """Main function with command line argument handling"""
    import sys
    import os
    from pathlib import Path
    
    # Handle command line arguments
    if len(sys.argv) < 2:
        print("Usage: python kicad_parser.py <input_file.kicad_sch> [output_file.json]")
        print("Example: python kicad_parser.py schematic.kicad_sch circuit.json")
        sys.exit(1)
    
    input_path = Path(sys.argv[1])
    
    # Determine output path
    if len(sys.argv) >= 3:
        output_path = Path(sys.argv[2])
    else:
        # Generate output filename based on input
        output_path = input_path.with_suffix('.json')
    
    # Validate input file
    if not input_path.exists():
        print(f"Error: Input file '{input_path}' does not exist")
        sys.exit(1)
    
    if not input_path.suffix.lower() == '.kicad_sch':
        print(f"Warning: Input file '{input_path}' does not have .kicad_sch extension")
    
    # Create output directory if it doesn't exist
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    # Parse the schematic
    parser = KiCadSchematicParser()
    
    try:
        print(f"Parsing KiCad schematic: {input_path}")
        result = parser.parse_file(str(input_path))
        
        # Save to JSON
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(result, f, indent=2, ensure_ascii=False)
        
        print(f"Successfully parsed schematic and saved to: {output_path}")
        
        # Print statistics
        print(f"\nStatistics:")
        print(f"  Components: {len(result['components'])}")
        print(f"  Nets: {len(result['nets'])}")
        print(f"  Library symbols: {len(result['library_symbols'])}")
        print(f"  Wires: {len(result['wires'])}")
        print(f"  Junctions: {len(result['junctions'])}")
        print(f"  Labels: {len(result['labels'])}")
        
        # Show some component details
        if result['components']:
            print(f"\nComponents found:")
            for ref, comp in list(result['components'].items())[:10]:  # Show first 10
                print(f"  {ref}: {comp['value']} ({comp['library_id']})")
            if len(result['components']) > 10:
                print(f"  ... and {len(result['components']) - 10} more")
        
        # Show net connectivity
        if result['nets']:
            print(f"\nNet connectivity (first 5 nets):")
            for net_name, net_info in list(result['nets'].items())[:5]:
                pin_count = len(net_info['pins'])
                if pin_count > 0:
                    print(f"  {net_name}: {pin_count} pins connected")
                    for comp_ref, pin_num in net_info['pins'][:3]:  # Show first 3 pins
                        print(f"    - {comp_ref}.{pin_num}")
                    if len(net_info['pins']) > 3:
                        print(f"    - ... and {len(net_info['pins']) - 3} more pins")
        
    except FileNotFoundError:
        print(f"Error: Could not read file '{input_path}'")
        sys.exit(1)
    except PermissionError:
        print(f"Error: Permission denied accessing '{input_path}' or '{output_path}'")
        sys.exit(1)
    except Exception as e:
        print(f"Error parsing schematic: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

def parse_schematic_with_paths(input_file, output_file=None):
    """
    Convenience function for programmatic use with path handling
    
    Args:
        input_file: Path to KiCad schematic file (.kicad_sch)
        output_file: Optional path for JSON output (default: input_file.json)
    
    Returns:
        dict: Parsed schematic data
    """
    from pathlib import Path
    
    input_path = Path(input_file)
    
    if not input_path.exists():
        raise FileNotFoundError(f"Input file '{input_path}' does not exist")
    
    if output_file is None:
        output_path = input_path.with_suffix('.json')
    else:
        output_path = Path(output_file)
    
    # Create output directory if needed
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    # Parse the schematic file
    parser = KiCadSchematicParser()
    result = parser.parse_file(str(input_path))
    
    # Save to JSON
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(result, f, indent=2, ensure_ascii=False)
    
    print(f"Parsed {input_path} -> {output_path}")
    print(f"Found {len(result['components'])} components and {len(result['nets'])} nets")
    
    return result

if __name__ == "__main__":
    main()