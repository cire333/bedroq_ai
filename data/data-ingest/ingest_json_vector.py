import json
import re
from typing import Dict, List, Tuple, Set, Any
from dataclasses import dataclass, asdict
from collections import defaultdict
import urllib.parse

@dataclass
class ComponentInfo:
    """Structured component information"""
    reference: str
    value: str
    footprint: str
    library_id: str
    position: Dict[str, float]
    rotation: float
    datasheet: str = ""
    mpn: str = ""
    rating: str = ""
    description: str = ""
    pins: List[Dict] = None

@dataclass
class NetInfo:
    """Network/connection information"""
    name: str
    connected_components: List[str]
    connection_points: List[Dict]
    net_type: str = "signal"  # power, ground, signal, etc.

@dataclass
class FunctionalGroup:
    """Functional circuit grouping"""
    name: str
    components: List[str]
    function: str
    description: str
    input_signals: List[str]
    output_signals: List[str]

@dataclass
class CircuitAnalysis:
    """Complete circuit analysis results"""
    metadata: Dict
    components: List[ComponentInfo]
    nets: List[NetInfo]
    functional_groups: List[FunctionalGroup]
    power_rails: List[str]
    interface_connectors: List[str]
    protection_circuits: List[str]

class KiCadSchematicAnalyzer:
    """Analyzes KiCad schematic JSON files for vector database storage"""
    
    def __init__(self):
        self.component_categories = {
            'power': ['power:', '+5V', '+3V3', 'GND'],
            'ic': ['74HC', 'USBLC', 'TVS'],
            'passive': ['R_', 'C_', 'L_'],
            'diode': ['D_', 'LED'],
            'connector': ['Conn_', 'USB_', 'JST'],
            'protection': ['TVS', 'USBLC', 'ESD']
        }
        
    def analyze_schematic(self, json_data: Dict) -> CircuitAnalysis:
        """Main analysis function"""
        
        # Extract metadata
        metadata = self._extract_metadata(json_data)
        
        # Process components
        components = self._extract_components(json_data)
        
        # Process nets and connections
        nets = self._extract_nets(json_data, components)
        
        # Identify functional groups
        functional_groups = self._identify_functional_groups(components, nets)
        
        # Identify power rails
        power_rails = self._identify_power_rails(nets)
        
        # Identify interface connectors
        interface_connectors = self._identify_interface_connectors(components)
        
        # Identify protection circuits
        protection_circuits = self._identify_protection_circuits(components, nets)
        
        return CircuitAnalysis(
            metadata=metadata,
            components=components,
            nets=nets,
            functional_groups=functional_groups,
            power_rails=power_rails,
            interface_connectors=interface_connectors,
            protection_circuits=protection_circuits
        )
    
    def _extract_metadata(self, json_data: Dict) -> Dict:
        """Extract circuit metadata"""
        metadata = json_data.get('metadata', {})
        bedroq_meta = json_data.get('bedroq-meta', {})
        
        return {
            'title': metadata.get('title_block', {}).get('title', ''),
            'company': metadata.get('title_block', {}).get('company', ''),
            'revision': metadata.get('title_block', {}).get('rev', ''),
            'date': metadata.get('title_block', {}).get('date', ''),
            'generator': metadata.get('generator', ''),
            'original_filename': bedroq_meta.get('original_filename', ''),
            'parsed_date': bedroq_meta.get('parsed_date_readable', ''),
            'annotations': metadata.get('text_annotations', [])
        }
    
    def _extract_components(self, json_data: Dict) -> List[ComponentInfo]:
        """Extract component information"""
        components = []
        components_data = json_data.get('components', {})
        
        for ref, comp_data in components_data.items():
            # Extract datasheet URL
            datasheet = ""
            mpn = ""
            rating = ""
            
            if 'properties' in comp_data:
                props = comp_data['properties']
                datasheet = props.get('Datasheet', {}).get('value', '')
                mpn = props.get('mpn', {}).get('value', '') or props.get('MPN', {}).get('value', '')
                rating = props.get('Rating', {}).get('value', '')
            
            # Get library description
            lib_id = comp_data.get('library_id', ['', ''])
            if isinstance(lib_id, list) and len(lib_id) > 1:
                library_symbol = lib_id[1]
            else:
                library_symbol = str(lib_id)
            
            description = self._get_component_description(library_symbol, comp_data.get('value', ''))
            
            component = ComponentInfo(
                reference=comp_data.get('reference', ref),
                value=comp_data.get('value', ''),
                footprint=comp_data.get('footprint', ''),
                library_id=library_symbol,
                position=comp_data.get('position', {}),
                rotation=comp_data.get('rotation', 0.0),
                datasheet=datasheet,
                mpn=mpn,
                rating=rating,
                description=description,
                pins=list(comp_data.get('pins', {}).keys()) if comp_data.get('pins') else []
            )
            components.append(component)
        
        return components
    
    def _extract_nets(self, json_data: Dict, components: List[ComponentInfo]) -> List[NetInfo]:
        """Extract network connection information"""
        nets = []
        nets_data = json_data.get('nets', {})
        
        for net_name, net_data in nets_data.items():
            # Extract connected components from pins
            connected_components = []
            if 'pins' in net_data:
                for pin_connection in net_data['pins']:
                    if isinstance(pin_connection, list) and len(pin_connection) > 0:
                        connected_components.append(pin_connection[0])
            
            # Determine net type
            net_type = self._classify_net_type(net_name, net_data)
            
            # Extract connection points from wires
            connection_points = []
            if 'wires' in net_data:
                for wire in net_data['wires']:
                    connection_points.append({
                        'start': wire.get('start', {}),
                        'end': wire.get('end', {})
                    })
            
            net_info = NetInfo(
                name=net_name,
                connected_components=connected_components,
                connection_points=connection_points,
                net_type=net_type
            )
            nets.append(net_info)
        
        return nets
    
    def _classify_net_type(self, net_name: str, net_data: Dict) -> str:
        """Classify the type of network (power, ground, signal)"""
        name_lower = net_name.lower()
        
        # Check labels for hierarchical types
        labels = net_data.get('labels', [])
        for label in labels:
            if label.get('type') == 'hierarchical_label':
                if any(keyword in label.get('text', '').lower() 
                      for keyword in ['power', 'vcc', 'vdd', '+5v', '+3v3']):
                    return 'power'
                elif any(keyword in label.get('text', '').lower() 
                        for keyword in ['gnd', 'ground', 'vss']):
                    return 'ground'
                elif any(keyword in label.get('text', '').lower() 
                        for keyword in ['usb', 'sda', 'scl', 'data']):
                    return 'interface'
        
        # Check net name patterns
        if any(keyword in name_lower for keyword in ['power', 'vcc', 'vdd', '+5v', '+3v3']):
            return 'power'
        elif any(keyword in name_lower for keyword in ['gnd', 'ground']):
            return 'ground'
        elif any(keyword in name_lower for keyword in ['usb', 'sda', 'scl', 'uart', 'spi']):
            return 'interface'
        else:
            return 'signal'
    
    def _identify_functional_groups(self, components: List[ComponentInfo], 
                                  nets: List[NetInfo]) -> List[FunctionalGroup]:
        """Identify functional circuit groups"""
        functional_groups = []
        
        # Group components by proximity and connection patterns
        component_groups = self._group_components_by_function(components, nets)
        
        for group_name, group_info in component_groups.items():
            functional_groups.append(FunctionalGroup(
                name=group_name,
                components=group_info['components'],
                function=group_info['function'],
                description=group_info['description'],
                input_signals=group_info.get('inputs', []),
                output_signals=group_info.get('outputs', [])
            ))
        
        return functional_groups
    
    def _group_components_by_function(self, components: List[ComponentInfo], 
                                    nets: List[NetInfo]) -> Dict:
        """Group components by their functional purpose"""
        groups = {}
        
        # Identify power management circuits
        power_components = [c for c in components if any(
            keyword in c.library_id.lower() for keyword in ['regulator', 'converter']
        )]
        if power_components:
            groups['Power Management'] = {
                'components': [c.reference for c in power_components],
                'function': 'power_regulation',
                'description': 'Voltage regulation and power distribution'
            }
        
        # Identify USB interface
        usb_components = [c for c in components if 'USB' in c.library_id or 'USB' in c.value]
        if usb_components:
            groups['USB Interface'] = {
                'components': [c.reference for c in usb_components],
                'function': 'usb_interface',
                'description': 'USB communication interface'
            }
        
        # Identify I2C/Qwiic interface
        i2c_components = [c for c in components if 'Qwiic' in c.value or 'I2C' in c.value]
        if i2c_components:
            groups['I2C Interface'] = {
                'components': [c.reference for c in i2c_components],
                'function': 'i2c_interface',
                'description': 'I2C/Qwiic communication interface'
            }
        
        # Identify protection circuits
        protection_components = [c for c in components if any(
            keyword in c.library_id for keyword in ['TVS', 'ESD', 'USBLC']
        )]
        if protection_components:
            groups['Protection Circuits'] = {
                'components': [c.reference for c in protection_components],
                'function': 'esd_protection',
                'description': 'ESD and overvoltage protection'
            }
        
        # Identify buffer/driver circuits
        buffer_components = [c for c in components if '74HC' in c.library_id]
        if buffer_components:
            groups['Buffer/Driver Circuits'] = {
                'components': [c.reference for c in buffer_components],
                'function': 'signal_buffering',
                'description': 'Signal buffering and level conversion'
            }
        
        # Identify LED driver circuits
        led_components = [c for c in components if 'LED' in c.library_id or 'LED' in c.value]
        resistor_components = [c for c in components if c.library_id.startswith('Device:R')]
        if led_components and resistor_components:
            groups['LED Driver Circuits'] = {
                'components': [c.reference for c in led_components + resistor_components],
                'function': 'led_driving',
                'description': 'LED current limiting and control'
            }
        
        return groups
    
    def _identify_power_rails(self, nets: List[NetInfo]) -> List[str]:
        """Identify power rail networks"""
        power_rails = []
        for net in nets:
            if net.net_type in ['power', 'ground']:
                power_rails.append(net.name)
        return power_rails
    
    def _identify_interface_connectors(self, components: List[ComponentInfo]) -> List[str]:
        """Identify interface connectors"""
        interfaces = []
        for component in components:
            if any(keyword in component.library_id.lower() 
                  for keyword in ['conn_', 'usb_', 'jst']):
                interfaces.append(f"{component.reference}: {component.value}")
        return interfaces
    
    def _identify_protection_circuits(self, components: List[ComponentInfo], 
                                   nets: List[NetInfo]) -> List[str]:
        """Identify protection circuits"""
        protection = []
        for component in components:
            if any(keyword in component.library_id.lower() 
                  for keyword in ['tvs', 'esd', 'usblc', 'd_schottky']):
                protection.append(f"{component.reference}: {component.value}")
        return protection
    
    def _get_component_description(self, library_id: str, value: str) -> str:
        """Generate component description based on library ID and value"""
        descriptions = {
            'power:+5V': '5V power supply rail',
            'power:+3V3': '3.3V power supply rail', 
            'power:GND': 'Ground reference',
            'Device:R_US': 'Resistor (US symbol)',
            'Device:C_Small': 'Small capacitor',
            'Device:LED_Filled': 'Light Emitting Diode',
            'Device:D_TVS_Filled': 'Transient Voltage Suppressor diode',
            'Device:D_Schottky_Filled': 'Schottky diode',
            'winterbloom:74HC2G34': 'Dual buffer gate IC with Schmitt trigger inputs',
            'winterbloom:USBLC6-2SC6': 'USB ESD protection IC',
            'winterbloom:USB_B_Receptacle': 'USB Type B connector',
            'Connector_Generic:Conn_01x03': '3-pin connector',
            'Connector_Generic:Conn_01x04': '4-pin connector'
        }
        
        return descriptions.get(library_id, f"Electronic component: {value}")

def create_vector_embeddings(analysis: CircuitAnalysis) -> List[Dict]:
    """Create structured data suitable for vector database storage"""
    embeddings = []
    
    # Circuit overview embedding
    overview_text = f"""
    Circuit: {analysis.metadata['title']} by {analysis.metadata['company']}
    Components: {len(analysis.components)} total components
    Networks: {len(analysis.nets)} connections
    Functional Groups: {', '.join([fg.name for fg in analysis.functional_groups])}
    Power Rails: {', '.join(analysis.power_rails)}
    Interfaces: {', '.join(analysis.interface_connectors)}
    """
    
    embeddings.append({
        'type': 'circuit_overview',
        'content': overview_text.strip(),
        'metadata': analysis.metadata
    })
    
    # Component embeddings
    for component in analysis.components:
        comp_text = f"""
        Component {component.reference}: {component.value}
        Type: {component.description}
        Footprint: {component.footprint}
        Rating: {component.rating}
        Part Number: {component.mpn}
        Position: x={component.position.get('x', 0)}, y={component.position.get('y', 0)}
        """
        
        embeddings.append({
            'type': 'component',
            'content': comp_text.strip(),
            'metadata': asdict(component)
        })
    
    # Functional group embeddings
    for group in analysis.functional_groups:
        group_text = f"""
        Functional Group: {group.name}
        Function: {group.function}
        Description: {group.description}
        Components: {', '.join(group.components)}
        """
        
        embeddings.append({
            'type': 'functional_group',
            'content': group_text.strip(),
            'metadata': asdict(group)
        })
    
    # Network connection embeddings
    for net in analysis.nets:
        if len(net.connected_components) > 1:  # Only include nets with multiple connections
            net_text = f"""
            Network: {net.name}
            Type: {net.net_type}
            Connected Components: {', '.join(net.connected_components)}
            """
            
            embeddings.append({
                'type': 'network',
                'content': net_text.strip(),
                'metadata': asdict(net)
            })
    
    return embeddings

def main():
    """Main function to analyze KiCad schematic and generate vector embeddings"""
    
    # Load the JSON file
    with open('connections-1_cleaned.json', 'r') as file:
        json_data = json.load(file)
    
    # Initialize analyzer
    analyzer = KiCadSchematicAnalyzer()
    
    # Perform analysis
    analysis = analyzer.analyze_schematic(json_data)
    
    # Generate vector embeddings
    embeddings = create_vector_embeddings(analysis)
    
    # Print summary
    print(f"Circuit Analysis Summary:")
    print(f"- Title: {analysis.metadata['title']}")
    print(f"- Components: {len(analysis.components)}")
    print(f"- Networks: {len(analysis.nets)}")
    print(f"- Functional Groups: {len(analysis.functional_groups)}")
    print(f"- Vector Embeddings: {len(embeddings)}")
    
    # Save results
    with open('circuit_analysis.json', 'w') as f:
        json.dump({
            'analysis': asdict(analysis),
            'embeddings': embeddings
        }, f, indent=2)
    
    return embeddings

if __name__ == "__main__":
    embeddings = main()        