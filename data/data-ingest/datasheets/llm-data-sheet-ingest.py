#!/usr/bin/env python3
"""
Enhanced Datasheet Analyzer for Complex Technical Documents

This enhanced parser is designed to handle comprehensive datasheets like
microcontrollers, complex ICs, and detailed technical specifications that
include extensive tables, figures, and technical requirements.

Key Enhancements:
- Visual content recognition and description
- Complex table structure parsing
- Power management analysis
- Pin configuration mapping
- Timing and electrical specifications
- Boot/configuration requirements
"""

import os
import json
import argparse
import logging
import re
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Any, Optional
import base64

# Third-party imports
import anthropic
from dotenv import load_dotenv

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

class EnhancedDatasheetAnalyzer:
    """Enhanced analyzer for complex technical datasheets"""
    
    def __init__(self, api_key: Optional[str] = None):
        """Initialize the enhanced analyzer with Claude API"""
        self.api_key = api_key or os.getenv('ANTHROPIC_API_KEY')
        if not self.api_key:
            raise ValueError("ANTHROPIC_API_KEY not found in environment or provided")
        
        self.client = anthropic.Anthropic(api_key=self.api_key)
        
        # Enhanced analysis prompt for complex datasheets
        self.analysis_prompt = """
You are analyzing a comprehensive technical datasheet for a complex electronic component (microcontroller, SoC, or similar). This type of document requires specialized analysis techniques.

**CRITICAL: This is a complex technical datasheet requiring exhaustive analysis. Do not summarize - extract ALL technical details.**

# SECTION 1: COMPONENT IDENTIFICATION & ARCHITECTURE
- Extract component family, part numbers, variants, and revision information
- Identify chip architecture (cores, memory, peripherals)
- Extract block diagram information and functional relationships
- Document package variants and mechanical specifications
- Note manufacturing process and technology specifications

# SECTION 2: PIN ANALYSIS & PHYSICAL INTERFACE (CRITICAL)
## Pin Layout & Package Information:
- Extract ALL pin numbers, names, and functions from pin tables
- Document package types (QFN, BGA, etc.) with dimensions
- Analyze pin layout diagrams and orientation information
- Extract pin-to-pin mapping for different packages
- Document mechanical constraints and assembly requirements

## Electrical Pin Specifications:
- Extract voltage levels (VIH, VIL, VOH, VOL) for each pin type
- Document current specifications (source/sink capabilities)
- Identify power pins and their voltage domains
- Extract impedance, capacitance, and electrical characteristics
- Document drive strength options and configurations

## Pin Function Multiplexing:
- Extract GPIO matrix and IO MUX information
- Document alternate functions for each pin
- Identify strapping pins and boot configuration requirements
- Extract peripheral pin assignments and routing options

# SECTION 3: POWER MANAGEMENT (COMPREHENSIVE)
## Power Supply Requirements:
- Extract ALL voltage domains and supply requirements
- Document power-up/power-down sequences and timing
- Extract power consumption in different operating modes
- Document voltage supervisor and brown-out protection
- Extract battery operation guidelines and limitations

## Power Modes & Sleep States:
- Document all power modes (active, sleep, deep sleep, etc.)
- Extract current consumption for each mode
- Document wake-up sources and timing requirements
- Extract clock gating and power domain control

## Critical Power Warnings:
- Extract voltage limits that could cause permanent damage
- Document power-up timing constraints
- Extract reset requirements and timing specifications
- Document ESD protection and handling requirements

# SECTION 4: BOOT CONFIGURATION & INITIALIZATION
- Extract boot modes and selection methods
- Document strapping pin configurations and timing
- Extract eFuse programming and one-time settings
- Document initialization sequences and requirements
- Extract flash/memory boot configurations

# SECTION 5: MEMORY ARCHITECTURE & MAPPING
- Extract internal memory specifications (RAM, ROM, cache)
- Document external memory interfaces and limitations
- Extract address mapping and memory organization
- Document DMA capabilities and restrictions
- Extract memory protection and security features

# SECTION 6: PERIPHERAL INTERFACES (EXHAUSTIVE)
## Communication Interfaces:
- Extract ALL communication protocols (SPI, I2C, UART, etc.)
- Document interface specifications (speeds, modes, limitations)
- Extract pin assignments and alternate configurations
- Document electrical specifications for each interface

## Analog Peripherals:
- Extract ADC/DAC specifications and limitations
- Document analog pin assignments and constraints
- Extract calibration requirements and procedures
- Document analog reference and measurement accuracy

## Specialized Peripherals:
- Extract timer/counter specifications and capabilities
- Document PWM and motor control features
- Extract touch sensor and capacitive sensing
- Document any specialized interfaces (Ethernet, USB, etc.)

# SECTION 7: ELECTRICAL CHARACTERISTICS (DETAILED)
## DC Characteristics:
- Extract ALL electrical specifications from tables
- Document min/typical/max values for all parameters
- Extract temperature and voltage dependencies
- Document load conditions and measurement requirements

## AC Characteristics & Timing:
- Extract timing specifications (setup, hold, propagation)
- Document clock requirements and limitations
- Extract signal integrity requirements
- Document EMI/EMC considerations

## RF Characteristics (if applicable):
- Extract radio specifications (frequency, power, sensitivity)
- Document antenna requirements and matching
- Extract regulatory compliance information
- Document coexistence and interference specifications

# SECTION 8: VISUAL CONTENT ANALYSIS
## Figures & Diagrams:
For each figure, provide detailed description:
- Pin layout diagrams: Describe pin arrangement, numbering, orientation
- Block diagrams: Describe functional blocks and interconnections
- Timing diagrams: Describe timing relationships and critical parameters
- Package drawings: Describe mechanical specifications and dimensions
- Power schemes: Describe voltage domains and power flow

## Tables & Data:
- Identify table structure and relationships between columns
- Extract numerical data with units and conditions
- Document cross-references between tables and text
- Identify incomplete or missing data that requires visual inspection

# SECTION 9: CRITICAL OPERATING CONSTRAINTS
- Extract absolute maximum ratings and stress conditions
- Document operating temperature and environmental limits
- Extract reliability and qualification information
- Document handling and storage requirements
- Extract any conditions that void warranty or cause damage

# SECTION 10: DEVELOPMENT SUPPORT
- Extract development tool requirements
- Document programming and debugging interfaces
- Extract software frameworks and SDK requirements
- Document evaluation boards and reference designs
- Extract application notes and design guidelines

# SECTION 11: EXTRACTION LIMITATIONS & VISUAL REQUIREMENTS
## Successfully Extracted:
- List all technical specifications successfully extracted
- Document table data and numerical specifications
- Note text-based configuration information

## Requires Visual Analysis:
- Pin layout diagrams and package drawings
- Timing diagrams and waveforms
- Block diagrams and architecture illustrations
- Charts and performance graphs
- Mechanical drawings and dimensions

## Missing Information:
- Reference external documents (app notes, user guides)
- Incomplete specifications requiring additional sources
- Visual elements that cannot be interpreted from text

**FORMATTING REQUIREMENTS:**
- Use specific numerical values with units
- Include all min/typ/max specifications
- Preserve exact part numbers and designations
- Include table and figure references
- Note any assumptions or interpretations made

**CRITICAL: Extract EVERY technical specification, pin definition, timing requirement, and electrical parameter. This analysis will be used for hardware design decisions.**
"""

    def analyze_datasheet(self, pdf_path: str) -> Dict[str, Any]:
        """Analyze comprehensive technical datasheet"""
        logger.info(f"Analyzing complex datasheet: {pdf_path}")
        
        try:
            # Read PDF file
            pdf_bytes = self.read_pdf_file(pdf_path)
            pdf_base64 = base64.b64encode(pdf_bytes).decode('utf-8')
            
            # Send to Claude with parameters optimized for technical analysis
            response = self.client.messages.create(
                model="claude-3-5-sonnet-20241022",
                max_tokens=8000,  # Maximum for comprehensive analysis
                temperature=0.05,  # Very low for technical accuracy
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "document",
                                "source": {
                                    "type": "base64",
                                    "media_type": "application/pdf",
                                    "data": pdf_base64
                                }
                            },
                            {
                                "type": "text",
                                "text": self.analysis_prompt
                            }
                        ]
                    }
                ]
            )
            
            return {
                "raw_response": response.content[0].text,
                "analysis_successful": True,
                "error": None,
                "usage": {
                    "input_tokens": response.usage.input_tokens,
                    "output_tokens": response.usage.output_tokens
                }
            }
            
        except Exception as e:
            logger.error(f"Error analyzing datasheet: {e}")
            return {
                "raw_response": "",
                "analysis_successful": False,
                "error": str(e),
                "usage": None
            }

    def analyze_with_targeted_followups(self, pdf_path: str) -> Dict[str, Any]:
        """Perform comprehensive analysis with targeted follow-up questions"""
        logger.info(f"Starting comprehensive analysis with targeted follow-ups: {pdf_path}")
        
        # Initial comprehensive analysis
        initial_response = self.analyze_datasheet(pdf_path)
        if not initial_response["analysis_successful"]:
            return initial_response
        
        # Targeted follow-up questions for complex datasheets
        followup_questions = [
            """
            Focus on PIN ANALYSIS AND ELECTRICAL SPECIFICATIONS:
            
            1. Extract EVERY pin from the pin tables with exact specifications:
               - Pin number, name, alternate names, and functions
               - Electrical characteristics (VIH, VIL, VOH, VOL, current limits)
               - Power domain assignments and voltage requirements
               - Drive strength options and impedance specifications
            
            2. Analyze PIN LAYOUT DIAGRAMS:
               - Describe pin arrangement and numbering scheme
               - Note package orientation and pin 1 identification
               - Extract mechanical specifications and dimensions
               - Document any pin restrictions or special handling requirements
            
            3. Extract STRAPPING PINS and BOOT CONFIGURATION:
               - Identify all strapping pins and their functions
               - Document boot mode selection and timing requirements
               - Extract eFuse settings and one-time programmable options
            """,
            
            """
            Focus on POWER MANAGEMENT AND TIMING SPECIFICATIONS:
            
            1. Extract DETAILED POWER SPECIFICATIONS:
               - All voltage domains and supply requirements (with exact values)
               - Power-up/power-down sequences and timing constraints
               - Power consumption for each operating mode
               - Battery operation guidelines and voltage supervision
            
            2. Analyze TIMING DIAGRAMS and requirements:
               - Power-up timing (tSTBL, tRST, etc.)
               - Reset timing and hold requirements
               - Clock specifications and timing constraints
               - Any critical timing that could cause damage or malfunction
            
            3. Extract CRITICAL OPERATING LIMITS:
               - Absolute maximum ratings that could cause damage
               - Temperature and environmental operating limits
               - ESD protection specifications
               - Any handling or storage requirements
            """,
            
            """
            Focus on PERIPHERAL INTERFACES AND CONFIGURATION:
            
            1. Extract ALL COMMUNICATION INTERFACES:
               - SPI, I2C, UART specifications with exact parameters
               - Clock speeds, data rates, and electrical requirements
               - Pin assignments and alternate configurations
               - Protocol-specific requirements and limitations
            
            2. Extract MEMORY AND ADDRESS MAPPING:
               - Internal memory specifications (RAM, ROM, cache sizes)
               - External memory interfaces and limitations
               - Address mapping tables and memory organization
               - DMA capabilities and restrictions
            
            3. Extract ANALOG SPECIFICATIONS:
               - ADC/DAC specifications (resolution, accuracy, speed)
               - Analog pin assignments and voltage ranges
               - Reference voltage requirements
               - Calibration procedures and accuracy specifications
            """,
            
            """
            Focus on VISUAL CONTENT and MISSING INFORMATION:
            
            1. Describe VISUAL ELEMENTS that cannot be extracted:
               - Pin layout diagrams (orientation, mechanical details)
               - Block diagrams (internal architecture, signal flow)
               - Timing diagrams (specific waveforms and relationships)
               - Package drawings (mechanical dimensions, land patterns)
            
            2. Identify MISSING SPECIFICATIONS:
               - Tables that are referenced but not fully readable
               - External documents needed for complete specification
               - Visual charts or graphs with critical information
               - Any incomplete electrical or timing specifications
            
            3. Extract DEVELOPMENT AND PROGRAMMING information:
               - Programming interfaces (JTAG, SWD, etc.)
               - Development tool requirements
               - Software frameworks and SDK information
               - Evaluation board recommendations
            """
        ]
        
        pdf_bytes = self.read_pdf_file(pdf_path)
        pdf_base64 = base64.b64encode(pdf_bytes).decode('utf-8')
        
        followup_responses = []
        
        for i, question in enumerate(followup_questions, 1):
            logger.info(f"Executing follow-up analysis {i}/4...")
            try:
                response = self.client.messages.create(
                    model="claude-3-5-sonnet-20241022",
                    max_tokens=6000,
                    temperature=0.05,
                    messages=[
                        {
                            "role": "user",
                            "content": [
                                {
                                    "type": "document",
                                    "source": {
                                        "type": "base64",
                                        "media_type": "application/pdf",
                                        "data": pdf_base64
                                    }
                                },
                                {
                                    "type": "text",
                                    "text": question
                                }
                            ]
                        }
                    ]
                )
                followup_responses.append(response.content[0].text)
                
            except Exception as e:
                logger.warning(f"Follow-up question {i} failed: {e}")
                followup_responses.append(f"Follow-up {i} failed: {e}")
        
        # Combine all responses
        combined_response = initial_response["raw_response"]
        combined_response += "\n\n" + "="*80 + "\n"
        combined_response += "TARGETED FOLLOW-UP ANALYSIS - DETAILED TECHNICAL SPECIFICATIONS\n"
        combined_response += "="*80 + "\n\n"
        
        followup_titles = [
            "PIN ANALYSIS AND ELECTRICAL SPECIFICATIONS",
            "POWER MANAGEMENT AND TIMING SPECIFICATIONS", 
            "PERIPHERAL INTERFACES AND CONFIGURATION",
            "VISUAL CONTENT AND MISSING INFORMATION"
        ]
        
        for i, (title, followup) in enumerate(zip(followup_titles, followup_responses), 1):
            combined_response += f"\n{'='*20} {title} {'='*20}\n\n"
            combined_response += followup + "\n"
        
        return {
            "raw_response": combined_response,
            "analysis_successful": True,
            "error": None,
            "initial_response": initial_response["raw_response"],
            "followup_responses": followup_responses,
            "analysis_method": "comprehensive_with_targeted_followups"
        }

    def read_pdf_file(self, file_path: str) -> bytes:
        """Read PDF file and return as bytes"""
        try:
            with open(file_path, 'rb') as file:
                return file.read()
        except Exception as e:
            logger.error(f"Error reading PDF file {file_path}: {e}")
            raise

    def parse_enhanced_response(self, raw_response: str, pdf_path: str) -> Dict[str, Any]:
        """Parse Claude's response into enhanced structured format for complex datasheets"""
        
        structured_output = {
            "metadata": {
                "datasheet_file": Path(pdf_path).name,
                "analysis_timestamp": datetime.now().isoformat(),
                "analyzer_version": "3.0.0",
                "analysis_type": "enhanced_complex_datasheet",
                "analysis_successful": True
            },
            "component_identification": {
                "component_family": "",
                "part_numbers": [],
                "variants": [],
                "chip_revisions": [],
                "package_types": [],
                "technology_node": "",
                "architecture": {}
            },
            "pin_specifications": {
                "total_pin_count": 0,
                "package_variants": [],
                "pin_definitions": [],
                "electrical_characteristics": {},
                "pin_layout_info": [],
                "strapping_pins": [],
                "power_pins": [],
                "gpio_matrix": []
            },
            "power_management": {
                "voltage_domains": [],
                "power_modes": [],
                "power_consumption": {},
                "power_sequences": [],
                "critical_power_warnings": [],
                "battery_operation": [],
                "voltage_supervision": []
            },
            "boot_configuration": {
                "boot_modes": [],
                "strapping_configurations": [],
                "efuse_settings": [],
                "initialization_sequences": [],
                "configuration_timing": []
            },
            "memory_architecture": {
                "internal_memory": {},
                "external_memory_interfaces": [],
                "address_mapping": [],
                "dma_capabilities": [],
                "memory_protection": []
            },
            "peripheral_interfaces": {
                "communication_interfaces": [],
                "analog_peripherals": [],
                "specialized_peripherals": [],
                "interface_specifications": {},
                "pin_assignments": []
            },
            "electrical_characteristics": {
                "dc_characteristics": {},
                "ac_characteristics": {},
                "timing_specifications": {},
                "rf_specifications": {},
                "environmental_limits": {}
            },
            "visual_content_analysis": {
                "figures_described": [],
                "pin_layout_diagrams": [],
                "block_diagrams": [],
                "timing_diagrams": [],
                "package_drawings": [],
                "mechanical_specifications": []
            },
            "critical_constraints": {
                "absolute_maximum_ratings": [],
                "operating_limits": [],
                "reliability_specifications": [],
                "handling_requirements": [],
                "damage_conditions": []
            },
            "development_support": {
                "programming_interfaces": [],
                "development_tools": [],
                "software_frameworks": [],
                "evaluation_boards": [],
                "design_guidelines": []
            },
            "extraction_analysis": {
                "successfully_extracted": [],
                "requires_visual_analysis": [],
                "missing_information": [],
                "external_references": [],
                "incomplete_specifications": []
            },
            "raw_analysis": {
                "full_response": raw_response,
                "response_length": len(raw_response),
                "analysis_sections": self._identify_sections(raw_response)
            }
        }
        
        # Enhanced parsing for complex datasheets
        self._parse_enhanced_content(raw_response, structured_output)
        
        return structured_output

    def _identify_sections(self, response: str) -> List[str]:
        """Identify major sections in the response"""
        sections = []
        section_patterns = [
            r'(?i)section\s+\d+[:.]?\s*([^:\n]+)',
            r'(?i)#{1,3}\s*([^:\n]+)',
            r'(?i)^([A-Z][A-Z\s&]{10,50})[:.]?\s*$'
        ]
        
        for pattern in section_patterns:
            matches = re.findall(pattern, response, re.MULTILINE)
            sections.extend(matches)
        
        return sections[:20]  # Limit to reasonable number

    def _parse_enhanced_content(self, response: str, output: Dict):
        """Enhanced parsing for complex technical content"""
        
        # Extract component identification
        self._extract_component_info(response, output)
        
        # Extract pin specifications
        self._extract_pin_specifications(response, output)
        
        # Extract power management
        self._extract_power_management(response, output)
        
        # Extract electrical characteristics
        self._extract_electrical_characteristics(response, output)
        
        # Extract visual content analysis
        self._extract_visual_content(response, output)

    def _extract_component_info(self, response: str, output: Dict):
        """Extract component identification information"""
        # Look for part numbers
        part_patterns = [
            r'ESP32[-_][A-Z0-9]+[-_]?[A-Z0-9]*',
            r'[A-Z]{2,}\d{2,}[A-Z]*[-_]?[A-Z0-9]*'
        ]
        
        parts = []
        for pattern in part_patterns:
            matches = re.findall(pattern, response, re.IGNORECASE)
            parts.extend(matches)
        
        output["component_identification"]["part_numbers"] = list(set(parts))[:10]
        
        # Extract package information
        package_matches = re.findall(r'QFN\s*\d+[×x]\d+|BGA\s*\d+|TQFP\s*\d+', response, re.IGNORECASE)
        output["component_identification"]["package_types"] = list(set(package_matches))

    def _extract_pin_specifications(self, response: str, output: Dict):
        """Extract comprehensive pin specifications"""
        # Extract pin count
        pin_count_match = re.search(r'(\d+)\s*(?:pin|gpio|i/?o)', response, re.IGNORECASE)
        if pin_count_match:
            output["pin_specifications"]["total_pin_count"] = int(pin_count_match.group(1))
        
        # Extract voltage levels
        voltage_patterns = [
            (r'VIH[:\s]*([0-9.]+)\s*V', 'input_high_voltage'),
            (r'VIL[:\s]*([0-9.]+)\s*V', 'input_low_voltage'),
            (r'VOH[:\s]*([0-9.]+)\s*V', 'output_high_voltage'),
            (r'VOL[:\s]*([0-9.]+)\s*V', 'output_low_voltage')
        ]
        
        electrical_chars = {}
        for pattern, key in voltage_patterns:
            match = re.search(pattern, response, re.IGNORECASE)
            if match:
                electrical_chars[key] = f"{match.group(1)}V"
        
        output["pin_specifications"]["electrical_characteristics"] = electrical_chars

    def _extract_power_management(self, response: str, output: Dict):
        """Extract power management specifications"""
        # Extract power modes
        power_modes = []
        mode_patterns = [
            r'(active|sleep|deep[_\s]*sleep|hibernation|modem[_\s]*sleep)\s*mode',
            r'(light[_\s]*sleep|power[_\s]*down|standby)\s*mode'
        ]
        
        for pattern in mode_patterns:
            matches = re.findall(pattern, response, re.IGNORECASE)
            power_modes.extend([match.replace('_', ' ').title() for match in matches])
        
        output["power_management"]["power_modes"] = list(set(power_modes))
        
        # Extract current consumption
        current_patterns = re.findall(r'(\d+\.?\d*)\s*(µA|uA|mA|A)', response)
        power_consumption = {}
        for value, unit in current_patterns[:10]:  # Limit to reasonable number
            power_consumption[f"consumption_{len(power_consumption)}"] = f"{value}{unit}"
        
        output["power_management"]["power_consumption"] = power_consumption

    def _extract_electrical_characteristics(self, response: str, output: Dict):
        """Extract electrical characteristics and specifications"""
        # Temperature specifications
        temp_matches = re.findall(r'(-?\d+\.?\d*)\s*°C?\s*[~to-]\s*(\+?\d+\.?\d*)\s*°C', response)
        if temp_matches:
            output["electrical_characteristics"]["temperature_range"] = f"{temp_matches[0][0]}°C to {temp_matches[0][1]}°C"
        
        # Frequency specifications
        freq_matches = re.findall(r'(\d+\.?\d*)\s*(MHz|GHz|KHz|Hz)', response, re.IGNORECASE)
        frequencies = {}
        for value, unit in freq_matches[:10]:
            frequencies[f"frequency_{len(frequencies)}"] = f"{value}{unit}"
        
        output["electrical_characteristics"]["frequency_specifications"] = frequencies

    def _extract_visual_content(self, response: str, output: Dict):
        """Extract information about visual content that requires analysis"""
        # Look for figure references
        figure_refs = re.findall(r'[Ff]igure\s*(\d+[-.]?\d*)[:\s]*([^.\n]+)', response)
        figures = []
        for ref, description in figure_refs:
            figures.append({
                "figure_number": ref,
                "description": description.strip()
            })
        
        output["visual_content_analysis"]["figures_described"] = figures[:20]
        
        # Look for table references
        table_refs = re.findall(r'[Tt]able\s*(\d+[-.]?\d*)[:\s]*([^.\n]+)', response)
        tables = []
        for ref, description in table_refs:
            tables.append({
                "table_number": ref,
                "description": description.strip()
            })
        
        output["visual_content_analysis"]["tables_referenced"] = tables[:20]

    def save_enhanced_results(self, results: Dict[str, Any], output_path: str):
        """Save enhanced analysis results to JSON file"""
        try:
            with open(output_path, 'w', encoding='utf-8') as f:
                json.dump(results, f, indent=2, ensure_ascii=False)
            logger.info(f"Enhanced results saved to {output_path}")
        except Exception as e:
            logger.error(f"Error saving enhanced results: {e}")
            raise

    def generate_enhanced_summary(self, results: Dict[str, Any]) -> str:
        """Generate enhanced summary for complex datasheet analysis"""
        
        report = []
        report.append("=" * 80)
        report.append("ENHANCED DATASHEET ANALYSIS SUMMARY")
        report.append("=" * 80)
        
        # Component identification
        comp_id = results.get("component_identification", {})
        if comp_id.get("part_numbers"):
            report.append(f"\n📱 COMPONENT: {', '.join(comp_id['part_numbers'][:3])}")
        
        if comp_id.get("package_types"):
            report.append(f"📦 PACKAGES: {', '.join(comp_id['package_types'])}")
        
        # Pin specifications
        pin_specs = results.get("pin_specifications", {})
        pin_count = pin_specs.get("total_pin_count", 0)
        if pin_count:
            report.append(f"\n🔌 PINS: {pin_count} total pins")
        
        electrical = pin_specs.get("electrical_characteristics", {})
        if electrical:
            report.append(f"⚡ ELECTRICAL: {len(electrical)} specifications extracted")
        
        # Power management
        power = results.get("power_management", {})
        power_modes = power.get("power_modes", [])
        if power_modes:
            report.append(f"\n🔋 POWER MODES: {', '.join(power_modes[:4])}")
        
        power_consumption = power.get("power_consumption", {})
        if power_consumption:
            report.append(f"⚡ CONSUMPTION: {len(power_consumption)} measurements")
        
        # Peripheral interfaces
        peripherals = results.get("peripheral_interfaces", {})
        comm_interfaces = peripherals.get("communication_interfaces", [])
        if comm_interfaces:
            report.append(f"\n🔗 INTERFACES: {', '.join(comm_interfaces[:5])}")
        
        # Visual content analysis
        visual = results.get("visual_content_analysis", {})
        figures = visual.get("figures_described", [])
        if figures:
            report.append(f"\n📊 FIGURES ANALYZED: {len(figures)} diagrams/drawings")
        
        # Critical constraints
        constraints = results.get("critical_constraints", {})
        max_ratings = constraints.get("absolute_maximum_ratings", [])
        if max_ratings:
            report.append(f"\n⚠️  CRITICAL LIMITS: {len(max_ratings)} absolute maximum ratings")
        
        # Extraction analysis
        extraction = results.get("extraction_analysis", {})
        successfully_extracted = extraction.get("successfully_extracted", [])
        requires_visual = extraction.get("requires_visual_analysis", [])
        
        if successfully_extracted:
            report.append(f"\n✅ EXTRACTED: {len(successfully_extracted)} specifications")
        
        if requires_visual:
            report.append(f"⚠️  VISUAL REQUIRED: {len(requires_visual)} elements need image analysis")
        
        # Analysis metadata
        metadata = results.get("metadata", {})
        if metadata.get("analysis_type"):
            report.append(f"\n📈 ANALYSIS: {metadata['analysis_type']}")
        
        timestamp = metadata.get("analysis_timestamp", "")
        if timestamp:
            report.append(f"🕒 COMPLETED: {timestamp}")
        
        report.append("=" * 80)
        
        return "\n".join(report)

    def analyze_and_save_enhanced(self, pdf_path: str, output_dir: str = "output", 
                                use_comprehensive: bool = True) -> Dict[str, Any]:
        """Complete enhanced analysis workflow"""
        logger.info(f"Starting enhanced analysis workflow for: {pdf_path}")
        
        # Create output directory
        output_path = Path(output_dir)
        output_path.mkdir(exist_ok=True)
        
        # Get base filename for outputs
        pdf_name = Path(pdf_path).stem
        
        try:
            # Perform analysis (comprehensive or standard)
            if use_comprehensive:
                logger.info("Using comprehensive analysis with targeted follow-ups...")
                raw_results = self.analyze_with_targeted_followups(pdf_path)
            else:
                logger.info("Using standard enhanced analysis...")
                raw_results = self.analyze_datasheet(pdf_path)
            
            if not raw_results["analysis_successful"]:
                logger.error(f"Analysis failed: {raw_results['error']}")
                return raw_results
            
            # Parse results into enhanced structure
            logger.info("Parsing results into enhanced structured format...")
            structured_results = self.parse_enhanced_response(
                raw_results["raw_response"], pdf_path
            )
            
            # Add analysis metadata
            structured_results["analysis_metadata"] = {
                "analysis_method": raw_results.get("analysis_method", "enhanced_standard"),
                "total_tokens": raw_results.get("usage", {}).get("input_tokens", 0) + 
                               raw_results.get("usage", {}).get("output_tokens", 0),
                "api_usage": raw_results.get("usage"),
                "analysis_successful": True
            }
            
            # Save structured results
            json_path = output_path / f"{pdf_name}_enhanced_analysis.json"
            self.save_enhanced_results(structured_results, str(json_path))
            
            # Save raw response for debugging
            raw_path = output_path / f"{pdf_name}_raw_response.txt"
            with open(raw_path, 'w', encoding='utf-8') as f:
                f.write(raw_results["raw_response"])
            
            # Generate and save summary
            summary = self.generate_enhanced_summary(structured_results)
            summary_path = output_path / f"{pdf_name}_summary.txt"
            with open(summary_path, 'w', encoding='utf-8') as f:
                f.write(summary)
            
            # Print summary to console
            print("\n" + summary)
            
            logger.info(f"Enhanced analysis complete. Files saved to {output_dir}/")
            logger.info(f"- Structured data: {json_path}")
            logger.info(f"- Raw response: {raw_path}")
            logger.info(f"- Summary: {summary_path}")
            
            return {
                "analysis_successful": True,
                "structured_results": structured_results,
                "output_files": {
                    "json": str(json_path),
                    "raw": str(raw_path),
                    "summary": str(summary_path)
                },
                "summary": summary
            }
            
        except Exception as e:
            logger.error(f"Enhanced analysis workflow failed: {e}")
            return {
                "analysis_successful": False,
                "error": str(e),
                "structured_results": None,
                "output_files": None,
                "summary": None
            }


def main():
    """Main CLI interface for enhanced datasheet analysis"""
    parser = argparse.ArgumentParser(
        description="Enhanced Datasheet Analyzer for Complex Technical Documents",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Standard enhanced analysis
  python enhanced_analyzer.py datasheet.pdf
  
  # Comprehensive analysis with targeted follow-ups
  python enhanced_analyzer.py datasheet.pdf --comprehensive
  
  # Specify custom output directory
  python enhanced_analyzer.py datasheet.pdf --output ./analysis_results/
  
  # Multiple files with comprehensive analysis
  python enhanced_analyzer.py *.pdf --comprehensive --output ./results/

This enhanced analyzer is specifically designed for complex technical datasheets
including microcontrollers, SoCs, and detailed electronic component specifications.
It provides comprehensive extraction of:

- Pin specifications and electrical characteristics
- Power management and timing requirements  
- Boot configuration and initialization sequences
- Peripheral interfaces and protocol specifications
- Visual content analysis and mechanical specifications
- Critical operating constraints and reliability data

The comprehensive mode uses targeted follow-up questions to ensure maximum
extraction of technical specifications and identifies content requiring visual analysis.
        """
    )
    
    parser.add_argument(
        "pdf_files", 
        nargs="+", 
        help="PDF datasheet file(s) to analyze"
    )
    
    parser.add_argument(
        "--output", "-o",
        default="enhanced_analysis_output",
        help="Output directory for analysis results (default: enhanced_analysis_output)"
    )
    
    parser.add_argument(
        "--comprehensive", "-c",
        action="store_true",
        help="Use comprehensive analysis with targeted follow-up questions (recommended for complex datasheets)"
    )
    
    parser.add_argument(
        "--api-key",
        help="Anthropic API key (default: from ANTHROPIC_API_KEY environment variable)"
    )
    
    parser.add_argument(
        "--verbose", "-v",
        action="store_true",
        help="Enable verbose logging"
    )
    
    args = parser.parse_args()
    
    # Configure logging level
    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)
    
    # Initialize analyzer
    try:
        analyzer = EnhancedDatasheetAnalyzer(api_key=args.api_key)
    except ValueError as e:
        print(f"❌ Error: {e}")
        print("💡 Please set ANTHROPIC_API_KEY environment variable or use --api-key option")
        return 1
    
    # Process each PDF file
    successful_analyses = 0
    total_files = len(args.pdf_files)
    
    print(f"\n🚀 Starting enhanced datasheet analysis for {total_files} file(s)")
    print(f"📁 Output directory: {args.output}")
    print(f"🔧 Analysis mode: {'Comprehensive' if args.comprehensive else 'Standard Enhanced'}")
    print("=" * 80)
    
    for i, pdf_file in enumerate(args.pdf_files, 1):
        print(f"\n📄 Processing file {i}/{total_files}: {pdf_file}")
        
        if not Path(pdf_file).exists():
            print(f"❌ Error: File not found: {pdf_file}")
            continue
        
        try:
            result = analyzer.analyze_and_save_enhanced(
                pdf_file, 
                args.output, 
                use_comprehensive=args.comprehensive
            )
            
            if result["analysis_successful"]:
                successful_analyses += 1
                print(f"✅ Analysis complete for {pdf_file}")
            else:
                print(f"❌ Analysis failed for {pdf_file}: {result.get('error', 'Unknown error')}")
                
        except Exception as e:
            print(f"❌ Unexpected error processing {pdf_file}: {e}")
            logger.exception(f"Unexpected error processing {pdf_file}")
    
    # Final summary
    print("\n" + "=" * 80)
    print(f"📊 ANALYSIS COMPLETE")
    print(f"✅ Successful: {successful_analyses}/{total_files}")
    print(f"📁 Results saved to: {args.output}/")
    
    if successful_analyses < total_files:
        print(f"⚠️  {total_files - successful_analyses} file(s) failed - check logs for details")
        return 1
    
    print("🎉 All analyses completed successfully!")
    return 0


if __name__ == "__main__":
    exit(main())

     # python llm-data-sheet-ingest.py ../datasheets/esp32_datasheet_en.pdf --output ../output --api-key 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 