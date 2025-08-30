#!/usr/bin/env python3
"""
Datasheet PDF Parser for Pinout and Connection Requirements Extraction

This parser extracts pin definitions, connection requirements, and electrical
specifications from component datasheets in PDF format.

Dependencies:
    pip install PyPDF2 pdfplumber tabula-py pandas numpy opencv-python pytesseract
    pip install camelot-py[cv] # For table extraction
    pip install pdfminer.six # Alternative PDF text extraction
"""

import re
import json
import logging
from typing import Dict, List, Optional, Tuple, Any
from dataclasses import dataclass, asdict
from pathlib import Path
import warnings

# PDF processing libraries
import PyPDF2
import pdfplumber
import pandas as pd

# Table extraction
try:
    import camelot
    CAMELOT_AVAILABLE = True
except ImportError:
    CAMELOT_AVAILABLE = False
    warnings.warn("Camelot not available. Table extraction will be limited.")

try:
    import tabula
    TABULA_AVAILABLE = True
except ImportError:
    TABULA_AVAILABLE = False
    warnings.warn("Tabula not available. Table extraction will be limited.")

# OCR for images (optional)
try:
    import cv2
    import pytesseract
    OCR_AVAILABLE = True
except ImportError:
    OCR_AVAILABLE = False
    warnings.warn("OCR libraries not available. Image text extraction disabled.")

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@dataclass
class PinDefinition:
    """Represents a single pin definition"""
    pin_number: Optional[str] = None
    pin_name: str = ""
    pin_type: str = ""  # INPUT, OUTPUT, BIDIRECTIONAL, POWER, GROUND
    description: str = ""
    voltage_min: Optional[float] = None
    voltage_max: Optional[float] = None
    voltage_typical: Optional[float] = None
    current_max: Optional[float] = None
    frequency_max: Optional[float] = None
    impedance: Optional[float] = None
    pull_up_down: Optional[str] = None
    timing_requirements: List[str] = None
    
    def __post_init__(self):
        if self.timing_requirements is None:
            self.timing_requirements = []

@dataclass
class ConnectionRequirement:
    """Represents connection requirements between pins"""
    pin_name: str
    requirement_type: str  # FILTER, RESISTOR, CAPACITOR, VOLTAGE_DIVIDER, etc.
    value: Optional[str] = None
    description: str = ""
    target_pin: Optional[str] = None

@dataclass
class ComponentSpec:
    """Complete component specification"""
    component_name: str = ""
    component_type: str = ""
    pins: List[PinDefinition] = None
    connection_requirements: List[ConnectionRequirement] = None
    operating_conditions: Dict[str, Any] = None
    electrical_characteristics: Dict[str, Any] = None
    
    def __post_init__(self):
        if self.pins is None:
            self.pins = []
        if self.connection_requirements is None:
            self.connection_requirements = []
        if self.operating_conditions is None:
            self.operating_conditions = {}
        if self.electrical_characteristics is None:
            self.electrical_characteristics = {}

class DatasheetParser:
    """Main parser class for extracting information from datasheets"""
    
    def __init__(self):
        self.text_patterns = self._initialize_patterns()
        
    def _initialize_patterns(self) -> Dict[str, re.Pattern]:
        """Initialize regex patterns for text extraction"""
        patterns = {
            # Pin patterns - original format
            'pin_definition': re.compile(r'(?:Pin|GPIO|P)\s*(\d+)\s*[:=]\s*([A-Z_]+)\s*[-–]\s*(.+?)(?:\n|$)', re.IGNORECASE),
            'pin_table_header': re.compile(r'Pin\s*(?:No\.?|Number|#)?\s*(?:Name|Signal|Function)', re.IGNORECASE),
            
            # Pin patterns - descriptive format (like SPI pins)
            'descriptive_pin': re.compile(r'([A-Z0-9_/]+)\s*\(([A-Z0-9_/]+)\)\s*:\s*(.+?)(?=\s+[A-Z0-9_/]+\s*\(|$)', re.IGNORECASE | re.DOTALL),
            'parenthetical_pin': re.compile(r'([A-Z0-9_/]+)\s*\(([A-Z0-9_/,\s]+)\)\s*:\s*([^.]+\.)', re.IGNORECASE),
            
            # Interface-specific patterns
            'spi_timing': re.compile(r'(?:Timing|SPI)\s*:\s*CPHL?\s*=\s*(\d+)\s*,\s*CPOL\s*=\s*(\d+)\s*\(([^)]+)\)', re.IGNORECASE),
            'i2c_address': re.compile(r'(?:I2C|slave)\s*address\s*:\s*0x([0-9A-F]+)', re.IGNORECASE),
            'uart_baud': re.compile(r'(?:baud|speed)\s*rate\s*:\s*(\d+)', re.IGNORECASE),
            
            # Pin function keywords
            'chip_select': re.compile(r'chip\s*select|slave\s*select|CS\b', re.IGNORECASE),
            'clock_signal': re.compile(r'clock\s*signal|CLK\b|SCL\b|SCLK\b', re.IGNORECASE),
            'data_signal': re.compile(r'data\s*signal|SDA\b|MOSI\b|MISO\b|DIN\b|DOUT\b', re.IGNORECASE),
            'control_pin': re.compile(r'control\s*pin|command\s*control|D/C\b|DC\b', re.IGNORECASE),
            'reset_pin': re.compile(r'reset\s*pin|RST\b|RESET\b', re.IGNORECASE),
            'interrupt_pin': re.compile(r'interrupt|IRQ\b|INT\b', re.IGNORECASE),
            'enable_pin': re.compile(r'enable|EN\b|CE\b', re.IGNORECASE),
            'power_pin': re.compile(r'power|VCC\b|VDD\b|V\+|supply', re.IGNORECASE),
            'ground_pin': re.compile(r'ground|GND\b|VSS\b|V-', re.IGNORECASE),
            
            # Voltage patterns
            'voltage_range': re.compile(r'(\d+\.?\d*)\s*V?\s*(?:to|[-–])\s*(\d+\.?\d*)\s*V', re.IGNORECASE),
            'voltage_typical': re.compile(r'(\d+\.?\d*)\s*V\s*(?:typ|typical)', re.IGNORECASE),
            'voltage_level': re.compile(r'(?:high|low)\s*level[:\s]*(\d+\.?\d*)\s*V', re.IGNORECASE),
            
            # Current patterns
            'current_max': re.compile(r'(\d+\.?\d*)\s*(?:mA|µA|A)\s*(?:max|maximum)', re.IGNORECASE),
            
            # Frequency patterns
            'frequency_max': re.compile(r'(\d+\.?\d*)\s*(?:MHz|KHz|Hz)\s*(?:max|maximum)', re.IGNORECASE),
            
            # Connection requirements
            'pull_up_resistor': re.compile(r'pull-?up\s*(?:resistor)?\s*(\d+\.?\d*)\s*(?:kΩ|kohm|ohm)', re.IGNORECASE),
            'decoupling_cap': re.compile(r'decoupling\s*(?:capacitor)?\s*(\d+\.?\d*)\s*(?:µF|uF|nF|pF)', re.IGNORECASE),
            
            # Component identification
            'component_name': re.compile(r'(?:^|\n)([A-Z0-9]+(?:-[A-Z0-9]+)*)\s*(?:Series|Family|Module)', re.MULTILINE),
        }
        return patterns
    
    def parse_pdf(self, pdf_path: str) -> ComponentSpec:
        """Main method to parse a PDF datasheet"""
        logger.info(f"Parsing datasheet: {pdf_path}")
        
        # Extract text from PDF
        text_content = self._extract_text_from_pdf(pdf_path)
        
        # Extract tables
        tables = self._extract_tables_from_pdf(pdf_path)
        
        # TODO: CUSTOM WORK NEEDED - Extract images and diagrams
        # images = self._extract_images_from_pdf(pdf_path)
        
        # Parse component specification
        spec = self._parse_component_spec(text_content, tables)
        
        return spec
    
    def _extract_text_from_pdf(self, pdf_path: str) -> str:
        """Extract text content from PDF using multiple methods"""
        text_content = ""
        
        # Method 1: PyPDF2
        try:
            with open(pdf_path, 'rb') as file:
                pdf_reader = PyPDF2.PdfReader(file)
                for page in pdf_reader.pages:
                    text_content += page.extract_text() + "\n"
        except Exception as e:
            logger.warning(f"PyPDF2 extraction failed: {e}")
        
        # Method 2: pdfplumber (often better for complex layouts)
        try:
            with pdfplumber.open(pdf_path) as pdf:
                for page in pdf.pages:
                    page_text = page.extract_text()
                    if page_text:
                        text_content += page_text + "\n"
        except Exception as e:
            logger.warning(f"pdfplumber extraction failed: {e}")
        
        return text_content
    
    def _extract_tables_from_pdf(self, pdf_path: str) -> List[pd.DataFrame]:
        """Extract tables from PDF using available libraries"""
        tables = []
        
        # Method 1: Camelot (best for complex tables)
        if CAMELOT_AVAILABLE:
            try:
                camelot_tables = camelot.read_pdf(pdf_path, pages='all')
                for table in camelot_tables:
                    if table.accuracy > 50:  # Only use tables with reasonable accuracy
                        tables.append(table.df)
            except Exception as e:
                logger.warning(f"Camelot table extraction failed: {e}")
        
        # Method 2: Tabula (good for simple tables)
        if TABULA_AVAILABLE:
            try:
                tabula_tables = tabula.read_pdf(pdf_path, pages='all', multiple_tables=True)
                tables.extend(tabula_tables)
            except Exception as e:
                logger.warning(f"Tabula table extraction failed: {e}")
        
        # Method 3: pdfplumber tables
        try:
            with pdfplumber.open(pdf_path) as pdf:
                for page in pdf.pages:
                    page_tables = page.extract_tables()
                    for table in page_tables:
                        if table and len(table) > 1:  # Ensure table has content
                            df = pd.DataFrame(table[1:], columns=table[0])
                            tables.append(df)
        except Exception as e:
            logger.warning(f"pdfplumber table extraction failed: {e}")
        
        logger.info(f"Extracted {len(tables)} tables from PDF")
        return tables
    
    def _parse_component_spec(self, text_content: str, tables: List[pd.DataFrame]) -> ComponentSpec:
        """Parse the component specification from text and tables"""
        spec = ComponentSpec()
        
        # Extract component name
        spec.component_name = self._extract_component_name(text_content)
        
        # Extract pins from text
        text_pins = self._extract_pins_from_text(text_content)
        spec.pins.extend(text_pins)
        
        # Extract pins from tables
        table_pins = self._extract_pins_from_tables(tables)
        spec.pins.extend(table_pins)
        
        # Remove duplicates (TODO: CUSTOM WORK NEEDED - improve deduplication logic)
        spec.pins = self._deduplicate_pins(spec.pins)
        
        # Extract connection requirements
        spec.connection_requirements = self._extract_connection_requirements(text_content)
        
        # Extract operating conditions
        spec.operating_conditions = self._extract_operating_conditions(text_content)
        
        # Extract electrical characteristics
        spec.electrical_characteristics = self._extract_electrical_characteristics(text_content, tables)
        
        return spec
    
    def _extract_component_name(self, text: str) -> str:
        """Extract component name from text"""
        # Look for title or header patterns
        lines = text.split('\n')
        for line in lines[:10]:  # Check first 10 lines
            line = line.strip()
            if len(line) > 5 and len(line) < 50:
                # Simple heuristic: look for alphanumeric patterns
                if re.match(r'^[A-Z0-9][A-Z0-9\-_\s]+$', line):
                    return line
        
        # Fallback to pattern matching
        match = self.text_patterns['component_name'].search(text)
        if match:
            return match.group(1)
        
        return "Unknown Component"
    
    def _extract_pins_from_text(self, text: str) -> List[PinDefinition]:
        """Extract pin definitions from text content"""
        pins = []
        
        # Method 1: Look for original pin definition patterns
        matches = self.text_patterns['pin_definition'].findall(text)
        for match in matches:
            pin_num, pin_name, description = match
            pin = PinDefinition(
                pin_number=pin_num,
                pin_name=pin_name.strip(),
                description=description.strip(),
                pin_type=self._classify_pin_type(pin_name, description)
            )
            pins.append(pin)
        
        # Method 2: Extract descriptive pin definitions (like SPI pins)
        descriptive_pins = self._extract_descriptive_pins(text)
        pins.extend(descriptive_pins)
        
        # Method 3: Extract parenthetical pin definitions
        parenthetical_pins = self._extract_parenthetical_pins(text)
        pins.extend(parenthetical_pins)
        
        return pins
    
    def _extract_descriptive_pins(self, text: str) -> List[PinDefinition]:
        """Extract pins from descriptive paragraphs (like SPI communication section)"""
        pins = []
        
        # Look for patterns like "CSB (CS): Slave chip select, when CS is low, the chip is enabled."
        matches = self.text_patterns['descriptive_pin'].findall(text)
        for match in matches:
            primary_name, alt_name, description = match
            description = description.strip()
            
            # Clean up the description - remove extra whitespace and line breaks
            description = ' '.join(description.split())
            
            pin = PinDefinition(
                pin_name=primary_name.strip(),
                description=description,
                pin_type=self._classify_pin_type(primary_name + " " + alt_name, description)
            )
            
            # Add alternate names as additional context
            if alt_name and alt_name.strip() != primary_name.strip():
                pin.description = f"({alt_name.strip()}) {pin.description}"
            
            # Extract additional specifications from description
            self._extract_pin_specifications(pin, description)
            
            pins.append(pin)
        
        return pins
    
    def _extract_parenthetical_pins(self, text: str) -> List[PinDefinition]:
        """Extract pins with parenthetical alternate names"""
        pins = []
        
        # Pattern for "SCL (SCK/SCLK): UART clock signal."
        matches = self.text_patterns['parenthetical_pin'].findall(text)
        for match in matches:
            primary_name, alt_names, description = match
            description = description.strip()
            
            pin = PinDefinition(
                pin_name=primary_name.strip(),
                description=description,
                pin_type=self._classify_pin_type(primary_name + " " + alt_names, description)
            )
            
            # Add alternate names
            if alt_names.strip():
                pin.description = f"({alt_names.strip()}) {pin.description}"
            
            # Extract specifications
            self._extract_pin_specifications(pin, description)
            
            pins.append(pin)
        
        return pins
    
    def _classify_pin_type(self, pin_name: str, description: str) -> str:
        """Classify pin type based on name and description"""
        combined_text = (pin_name + " " + description).upper()
        
        # Check for specific pin types
        if self.text_patterns['power_pin'].search(combined_text):
            return "POWER"
        elif self.text_patterns['ground_pin'].search(combined_text):
            return "GROUND"
        elif self.text_patterns['clock_signal'].search(combined_text):
            return "CLOCK"
        elif self.text_patterns['chip_select'].search(combined_text):
            return "CHIP_SELECT"
        elif self.text_patterns['data_signal'].search(combined_text):
            return "DATA"
        elif self.text_patterns['control_pin'].search(combined_text):
            return "CONTROL"
        elif self.text_patterns['reset_pin'].search(combined_text):
            return "RESET"
        elif self.text_patterns['interrupt_pin'].search(combined_text):
            return "INTERRUPT"
        elif self.text_patterns['enable_pin'].search(combined_text):
            return "ENABLE"
        elif "input" in description.lower():
            return "INPUT"
        elif "output" in description.lower():
            return "OUTPUT"
        elif "bidirectional" in description.lower() or "i/o" in description.lower():
            return "BIDIRECTIONAL"
        else:
            return "GENERAL"
    
    def _extract_pin_specifications(self, pin: PinDefinition, description: str):
        """Extract detailed specifications from pin description"""
        
        # Extract voltage levels
        if "low level" in description.lower():
            voltage_matches = self.text_patterns['voltage_level'].findall(description)
            if voltage_matches:
                pin.voltage_min = float(voltage_matches[0])
        
        if "high level" in description.lower():
            voltage_matches = self.text_patterns['voltage_level'].findall(description)
            if voltage_matches:
                pin.voltage_max = float(voltage_matches[0])
        
        # Extract timing requirements
        timing_info = []
        if "timing" in description.lower():
            # Extract SPI timing information
            spi_matches = self.text_patterns['spi_timing'].findall(description)
            for match in spi_matches:
                cphl, cpol, mode = match
                timing_info.append(f"SPI Mode: CPHL={cphl}, CPOL={cpol} ({mode})")
        
        if timing_info:
            pin.timing_requirements = timing_info
        
        # Extract pull-up/pull-down information
        if "pull-up" in description.lower():
            pin.pull_up_down = "PULL_UP"
        elif "pull-down" in description.lower():
            pin.pull_up_down = "PULL_DOWN"
    
    def _extract_pins_from_tables(self, tables: List[pd.DataFrame]) -> List[PinDefinition]:
        """Extract pin definitions from tables"""
        pins = []
        
        for table in tables:
            # TODO: CUSTOM WORK NEEDED - Improve table column detection
            # This is a simple heuristic that needs refinement
            
            if table.empty:
                continue
                
            # Look for pin-related columns
            columns = [col.lower() if isinstance(col, str) else str(col).lower() for col in table.columns]
            
            pin_col = None
            name_col = None
            desc_col = None
            
            for i, col in enumerate(columns):
                if any(keyword in col for keyword in ['pin', 'number', 'no.']):
                    pin_col = i
                elif any(keyword in col for keyword in ['name', 'signal', 'function']):
                    name_col = i
                elif any(keyword in col for keyword in ['description', 'desc']):
                    desc_col = i
            
            if pin_col is not None and name_col is not None:
                for _, row in table.iterrows():
                    pin_num = str(row.iloc[pin_col]) if pin_col < len(row) else None
                    pin_name = str(row.iloc[name_col]) if name_col < len(row) else ""
                    description = str(row.iloc[desc_col]) if desc_col is not None and desc_col < len(row) else ""
                    
                    if pin_name and pin_name.strip() not in ['', 'nan', 'None']:
                        pin = PinDefinition(
                            pin_number=pin_num,
                            pin_name=pin_name.strip(),
                            description=description.strip()
                        )
                        pins.append(pin)
        
        return pins
    
    def _extract_connection_requirements(self, text: str) -> List[ConnectionRequirement]:
        """Extract connection requirements from text"""
        requirements = []
        
        # Pull-up resistor requirements
        matches = self.text_patterns['pull_up_resistor'].findall(text)
        for match in matches:
            req = ConnectionRequirement(
                pin_name="",  # TODO: CUSTOM WORK NEEDED - Associate with specific pin
                requirement_type="PULL_UP_RESISTOR",
                value=f"{match}kΩ",
                description="Pull-up resistor requirement"
            )
            requirements.append(req)
        
        # Decoupling capacitor requirements
        matches = self.text_patterns['decoupling_cap'].findall(text)
        for match in matches:
            req = ConnectionRequirement(
                pin_name="VCC",  # Common assumption
                requirement_type="DECOUPLING_CAPACITOR",
                value=f"{match}µF",
                description="Decoupling capacitor requirement"
            )
            requirements.append(req)
        
        # SPI interface requirements
        spi_requirements = self._extract_spi_requirements(text)
        requirements.extend(spi_requirements)
        
        # I2C interface requirements
        i2c_requirements = self._extract_i2c_requirements(text)
        requirements.extend(i2c_requirements)
        
        return requirements
    
    def _extract_spi_requirements(self, text: str) -> List[ConnectionRequirement]:
        """Extract SPI-specific connection requirements"""
        requirements = []
        
        # Look for SPI timing requirements
        spi_matches = self.text_patterns['spi_timing'].findall(text)
        for match in spi_matches:
            cphl, cpol, mode = match
            req = ConnectionRequirement(
                pin_name="SPI_INTERFACE",
                requirement_type="SPI_TIMING",
                value=f"CPHL={cphl}, CPOL={cpol}",
                description=f"SPI timing configuration for {mode}"
            )
            requirements.append(req)
        
        # Check if SPI interface is mentioned and add general requirements
        if re.search(r'SPI\s+(?:interface|communication|timing)', text, re.IGNORECASE):
            req = ConnectionRequirement(
                pin_name="SPI_INTERFACE",
                requirement_type="INTERFACE_REQUIREMENT",
                value="SPI",
                description="Requires SPI interface connection (CS, CLK, MOSI, MISO)"
            )
            requirements.append(req)
        
        return requirements
    
    def _extract_i2c_requirements(self, text: str) -> List[ConnectionRequirement]:
        """Extract I2C-specific connection requirements"""
        requirements = []
        
        # Look for I2C address
        i2c_matches = self.text_patterns['i2c_address'].findall(text)
        for match in matches:
            req = ConnectionRequirement(
                pin_name="I2C_INTERFACE",
                requirement_type="I2C_ADDRESS",
                value=f"0x{match}",
                description="I2C slave address"
            )
            requirements.append(req)
        
        # Check if I2C interface is mentioned
        if re.search(r'I2C\s+(?:interface|communication)', text, re.IGNORECASE):
            req = ConnectionRequirement(
                pin_name="I2C_INTERFACE",
                requirement_type="INTERFACE_REQUIREMENT",
                value="I2C",
                description="Requires I2C interface connection (SDA, SCL)"
            )
            requirements.append(req)
        
        return requirements
    
    def _extract_operating_conditions(self, text: str) -> Dict[str, Any]:
        """Extract operating conditions from text"""
        conditions = {}
        
        # Temperature range
        temp_matches = re.findall(r'(?:operating|work|temperature)\s*(?:range)?\s*[:\-]?\s*(-?\d+\.?\d*)\s*°?C?\s*(?:to|[-–])\s*(-?\d+\.?\d*)\s*°?C', text, re.IGNORECASE)
        if temp_matches:
            conditions['temperature_range'] = f"{temp_matches[0][0]}°C to {temp_matches[0][1]}°C"
        
        # Voltage range
        voltage_matches = self.text_patterns['voltage_range'].findall(text)
        if voltage_matches:
            conditions['voltage_range'] = f"{voltage_matches[0][0]}V to {voltage_matches[0][1]}V"
        
        return conditions
    
    def _extract_electrical_characteristics(self, text: str, tables: List[pd.DataFrame]) -> Dict[str, Any]:
        """Extract electrical characteristics from text and tables"""
        characteristics = {}
        
        # TODO: CUSTOM WORK NEEDED - This requires sophisticated parsing
        # of electrical specification tables and charts
        
        # Simple text-based extraction
        current_matches = self.text_patterns['current_max'].findall(text)
        if current_matches:
            characteristics['max_current'] = current_matches[0] + "mA"
        
        frequency_matches = self.text_patterns['frequency_max'].findall(text)
        if frequency_matches:
            characteristics['max_frequency'] = frequency_matches[0] + "MHz"
        
        return characteristics
    
    def _deduplicate_pins(self, pins: List[PinDefinition]) -> List[PinDefinition]:
        """Remove duplicate pin definitions"""
        # TODO: CUSTOM WORK NEEDED - Improve deduplication logic
        # This simple approach removes pins with the same name
        seen_names = set()
        unique_pins = []
        
        for pin in pins:
            if pin.pin_name not in seen_names:
                seen_names.add(pin.pin_name)
                unique_pins.append(pin)
        
        return unique_pins
    
    def _extract_images_from_pdf(self, pdf_path: str) -> List[Any]:
        """Extract images from PDF for further processing"""
        # TODO: CUSTOM WORK NEEDED - Implement image extraction
        # This would involve:
        # 1. Extracting images from PDF
        # 2. Using OCR to read text from images
        # 3. Parsing pinout diagrams
        # 4. Extracting information from charts and graphs
        
        logger.warning("Image extraction not implemented - CUSTOM WORK NEEDED")
        return []
    
    def save_specification(self, spec: ComponentSpec, output_path: str):
        """Save the parsed specification to a JSON file"""
        spec_dict = asdict(spec)
        
        with open(output_path, 'w') as f:
            json.dump(spec_dict, f, indent=2, default=str)
        
        logger.info(f"Specification saved to {output_path}")
    
    def generate_summary_report(self, spec: ComponentSpec) -> str:
        """Generate a human-readable summary report"""
        report = f"Component Specification Summary\n"
        report += f"================================\n\n"
        report += f"Component: {spec.component_name}\n"
        report += f"Type: {spec.component_type}\n\n"
        
        if spec.pins:
            report += f"Pins ({len(spec.pins)} total):\n"
            
            # Group pins by type for better organization
            pin_groups = {}
            for pin in spec.pins:
                pin_type = pin.pin_type or "GENERAL"
                if pin_type not in pin_groups:
                    pin_groups[pin_type] = []
                pin_groups[pin_type].append(pin)
            
            for pin_type, pins in pin_groups.items():
                report += f"\n  {pin_type} Pins:\n"
                for pin in pins[:5]:  # Show first 5 pins of each type
                    report += f"    - {pin.pin_name}"
                    if pin.pin_number:
                        report += f" (Pin {pin.pin_number})"
                    report += f": {pin.description}\n"
                    
                    # Add timing requirements if present
                    if pin.timing_requirements:
                        for timing in pin.timing_requirements:
                            report += f"      Timing: {timing}\n"
                    
                    # Add voltage info if present
                    if pin.voltage_min is not None or pin.voltage_max is not None:
                        voltage_info = "Voltage: "
                        if pin.voltage_min is not None:
                            voltage_info += f"Min={pin.voltage_min}V "
                        if pin.voltage_max is not None:
                            voltage_info += f"Max={pin.voltage_max}V "
                        report += f"      {voltage_info.strip()}\n"
                
                if len(pins) > 5:
                    report += f"    ... and {len(pins) - 5} more {pin_type.lower()} pins\n"
        
        if spec.connection_requirements:
            report += f"\nConnection Requirements ({len(spec.connection_requirements)} total):\n"
            for req in spec.connection_requirements:
                report += f"  - {req.requirement_type}"
                if req.pin_name:
                    report += f" ({req.pin_name})"
                if req.value:
                    report += f": {req.value}"
                report += f" - {req.description}\n"
        
        if spec.operating_conditions:
            report += f"\nOperating Conditions:\n"
            for key, value in spec.operating_conditions.items():
                report += f"  - {key}: {value}\n"
        
        if spec.electrical_characteristics:
            report += f"\nElectrical Characteristics:\n"
            for key, value in spec.electrical_characteristics.items():
                report += f"  - {key}: {value}\n"
        
        return report

def main():
    """Example usage of the datasheet parser"""
    parser = DatasheetParser()
    
    # Example usage
    pdf_path = "../epaper.pdf"  # Replace with actual path
    
    try:
        # Parse the datasheet
        spec = parser.parse_pdf(pdf_path)
        
        # Generate summary report
        report = parser.generate_summary_report(spec)
        print(report)
        
        # Save full specification
        parser.save_specification(spec, "component_spec.json")
        
        # Example of testing with the SPI pin text from your example
        test_text = """
        CSB (CS): Slave chip select, when CS is low, the chip is enabled.
        SCL (SCK/SCLK): UART clock signal.
        D/C (DC): Data/command control pin, writes commands at a low level; writes data/parameter at a high level.
        SDA (DIN): Serial data signal.
        Timing: CPHL=0, CPOL=0 (SPI0)
        """
        
        print("\n" + "="*50)
        print("TESTING SPI PIN EXTRACTION:")
        print("="*50)
        
        test_pins = parser._extract_pins_from_text(test_text)
        test_requirements = parser._extract_connection_requirements(test_text)
        
        print(f"\nExtracted {len(test_pins)} pins:")
        for pin in test_pins:
            print(f"  - {pin.pin_name} ({pin.pin_type}): {pin.description}")
            if pin.timing_requirements:
                print(f"    Timing: {pin.timing_requirements}")
        
        print(f"\nExtracted {len(test_requirements)} connection requirements:")
        for req in test_requirements:
            print(f"  - {req.requirement_type}: {req.value} - {req.description}")
        
    except Exception as e:
        logger.error(f"Error parsing datasheet: {e}")

if __name__ == "__main__":
    main()