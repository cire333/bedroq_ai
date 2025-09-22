#!/usr/bin/env python3
"""
Automated Datasheet Analysis Script

This script uploads datasheets to Claude for analysis and returns structured
JSON output with hardware development information, interface details,
precautions, and limitations.

Dependencies:
    pip install anthropic python-dotenv PyPDF2 pdfplumber

Usage:
    python datasheet_analyzer.py path/to/datasheet.pdf
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

class DatasheetAnalyzer:
    """Automated datasheet analysis using Claude API"""
    
    def __init__(self, api_key: Optional[str] = None):
        """Initialize the analyzer with Claude API"""
        self.api_key = api_key or os.getenv('ANTHROPIC_API_KEY')
        if not self.api_key:
            raise ValueError("ANTHROPIC_API_KEY not found in environment or provided")
        
        self.client = anthropic.Anthropic(api_key=self.api_key)
        
        # Analysis prompt template - Enhanced for better API responses
        self.analysis_prompt = """
You are an expert hardware engineer analyzing this datasheet. I need you to provide the same level of detailed analysis that you would give in an interactive conversation. Please be thorough, specific, and comprehensive in your analysis.

**CRITICAL INSTRUCTION: Please provide the same depth and quality of analysis as you would in the web interface. Do not summarize or abbreviate - give complete, detailed responses.**

Analyze this datasheet and extract ALL relevant hardware development information:

The prompt that you specified left out several key items from the data sheet can you update the prompt to include: 

All language that discusses input and output from the main chip needs to be captured in raw format


## 1. COMPONENT IDENTIFICATION & SPECIFICATIONS
- Extract the exact component name, part number, and type
- List ALL technical specifications (resolution, dimensions, voltage, current, power, timing)
- Document operating conditions (temperature, humidity, environmental limits)
- Extract physical characteristics and mechanical constraints
- Note any version differences or variants mentioned

## 2. INTERFACE & PIN ANALYSIS (BE EXHAUSTIVE)
- Identify ALL communication interfaces (SPI, I2C, UART, GPIO, parallel, etc.)
- For EACH pin, extract:
  * Pin name and any alternate names (like CSB/CS, SCL/SCK/SCLK)
  * Pin number if specified
  * Exact function and description
  * Pin type (input, output, bidirectional, power, ground, control)
  * Voltage levels (high/low thresholds, operating ranges)
  * Current specifications (max, typical, leakage)
  * Any special characteristics (pull-up/down, open-drain, etc.)
- Document ALL timing requirements and constraints
- Extract SPI/I2C modes, clock speeds, setup/hold times
- List connection tables for ALL mentioned platforms (Arduino, Raspberry Pi, STM32, etc.)

## 3. ELECTRICAL CHARACTERISTICS & REQUIREMENTS
- Extract ALL voltage specifications (operating, absolute max, typical)
- Document ALL current requirements (standby, active, peak, per pin)
- List power consumption in different modes
- Extract frequency limitations and timing constraints
- Document any required external components (resistors, capacitors, crystals)
- Note level conversion requirements
- Extract ESD protection specifications if mentioned
- GPIO Information and Pins, External connections such as eproms, flash, and RAM.
- General Purpose Input / Output Interface (GPIO) 
- Serial Peripheral Interface (SPI) 
- Universal Asynchronous Receiver Transmitter (UART) 
- CPU clocks
- Clock Generators
- RTC clocking information needs to be captured
- Power management, Power modes, lower power modes 
- coprocessor and interconnects between them and the main processor
- Instruction sets
- ALU - Perform Arithmetic/Logic Operations
- Cryptographic Hardware Accelerators 
- Radio and Wi-Fi 
- Bluetooth information 
- I2C Interface and I2S Interface
- Remote Control Peripheral 
- Pulse Counter Controller (PCNT) 
- LED PWM Controller 
- Motor Control PWM 
- SDIO/SPI Slave Controller 
- SD/SDIO/MMC Host Controller 
- Any 	ISO  protocol 
- Ethernet MAC Interface
- Analog-to-Digital Converter (ADC) 
- Digital-to-Analog Converter (DAC) 
- Touch Sensor 
- Recommended Power Supply Characteristics and power scheme, where to include filters and which types
- DC Characteristics  RF Current Consumption in Active Mode 
- Reliability 
- Wi-Fi Radio Characteristics 
- Analog pins
- Power pins
- Details in when and how to reset the device and what kind of latencies can be expected when restarting and how to avoid negative outcomes
- Any pin mapping between chip and flash if they are packaged together
- Boot configurations
- Chip Boot Mode Control
- Internal LDO (VDD_SDIO) Voltage Control 
- Timing Control of SDIO Slave 
- Save out Functional Descriptions that contain information bout CPU and Memory, Internal Memory, External Flash and RAM, Address Mapping structures, cache and system clocks
- Information about watchdog timers
- LED and Motor Control PWM Controller information 
- SD/SDIO/MMC Host Controllers
- TWAI Controllers
- Ethernet MAC information
- Packaging Diagrams


 

## 4. CRITICAL PRECAUTIONS & CONSTRAINTS (COMPREHENSIVE LIST)
- List ALL power management warnings and requirements
- Document timing constraints that could cause damage
- Extract environmental limitations and storage requirements
- List physical handling precautions
- Document refresh/update limitations and requirements
- Note any irreversible damage conditions
- Extract cable length limits and signal integrity requirements
- List initialization and sequencing requirements

## 5. CONNECTION REQUIREMENTS & INTERFACE DETAILS
- For each interface, document:
  * Required external components (pull-up resistors, decoupling caps, etc.)
  * Cable specifications and length limits
  * Signal integrity requirements
  * Connector specifications and pinouts
  * Level conversion requirements
- Extract ALL connection tables and pin mappings
- Document platform-specific connection details

## 6. DEVELOPMENT & IMPLEMENTATION GUIDANCE
- List ALL recommended development platforms and tools
- Extract software library requirements and installation procedures
- Document demo code locations and compilation instructions
- List testing and validation procedures
- Extract troubleshooting information and common issues
- Note development best practices mentioned in the document

## 7. REGISTER & CONTROL INFORMATION
- Extract any register addresses, bit fields, or control commands
- Document initialization sequences and configuration requirements
- List any calibration or setup procedures
- Extract waveform or control file information

## 8. TABLES & VISUAL CONTENT ANALYSIS
Categorize information into:
- **SUCCESSFULLY EXTRACTED**: List all tables, specifications, and data you can read
- **PARTIALLY EXTRACTED**: Information that's mentioned but incomplete
- **CANNOT EXTRACT**: Visual elements like:
  * Timing diagrams and waveforms
  * Schematic diagrams and circuit layouts
  * Mechanical drawings and physical layouts
  * Charts and graphs
  * Register bit field diagrams
  * Pin layout diagrams

## 9. MISSING INFORMATION & FUTURE PROCESSING
- List referenced external documents (datasheets, schematics, app notes)
- Note incomplete specifications that need additional sources
- Identify visual elements that require image processing
- Suggest what additional documents would be helpful

**IMPORTANT: Be as detailed and thorough as possible. Extract specific values, part numbers, voltage levels, timing constraints, and exact requirements. Provide the level of detail a hardware engineer would need to successfully implement this component in their design.**

**FORMAT: Use clear headers, bullet points, and organize information logically. Include specific values and measurements whenever available.**

** Log linked documentation it often has verbiage like “For details, see” followed by a hyper link. If possible log and save the hyperlink or the text if the hyperlink cannot be extracted
"""

    def read_pdf_file(self, file_path: str) -> bytes:
        """Read PDF file and return as bytes"""
        try:
            with open(file_path, 'rb') as file:
                return file.read()
        except Exception as e:
            logger.error(f"Error reading PDF file {file_path}: {e}")
            raise

    def analyze_datasheet(self, pdf_path: str) -> Dict[str, Any]:
        """Send datasheet to Claude for analysis with optimal parameters"""
        logger.info(f"Analyzing datasheet: {pdf_path}")
        
        try:
            # Read PDF file
            pdf_bytes = self.read_pdf_file(pdf_path)
            pdf_base64 = base64.b64encode(pdf_bytes).decode('utf-8')
            
            # Send to Claude with optimal parameters for detailed analysis
            response = self.client.messages.create(
                model="claude-3-5-sonnet-20241022",  # Use the latest model
                max_tokens=8000,  # Increased for more detailed responses
                temperature=0.1,  # Lower temperature for more factual, consistent output
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

    def analyze_with_followup(self, pdf_path: str) -> Dict[str, Any]:
        """Perform initial analysis followed by targeted follow-up questions"""
        logger.info(f"Starting comprehensive analysis with follow-up: {pdf_path}")
        
        # Initial analysis
        initial_response = self.analyze_datasheet(pdf_path)
        if not initial_response["analysis_successful"]:
            return initial_response
        
        # Follow-up questions for more detail
        followup_questions = [
            """
            Based on your initial analysis, please provide more specific details about:
            
            1. EXACT pin specifications - for each pin mentioned, what are the specific voltage thresholds, current limits, and timing requirements?
            
            2. CONNECTION TABLES - extract ALL the connection tables you found (Arduino, Raspberry Pi, STM32, etc.) with exact pin mappings
            
            3. CRITICAL WARNINGS - what are the specific conditions that could permanently damage this device? Be very specific about voltage limits, timing constraints, and operational limits.
            
            4. EXTERNAL COMPONENTS - what specific resistors, capacitors, or other components are required? Include values and specifications.
            """,
            
            """
            Please extract more details about:
            
            1. REGISTER INFORMATION - any register addresses, control commands, or initialization sequences mentioned
            
            2. TIMING DIAGRAMS - describe any timing information you can extract from text, even if you can't see the actual diagrams
            
            3. INTERFACE PROTOCOLS - specific details about SPI modes, I2C addresses, baud rates, etc.
            
            4. ENVIRONMENTAL SPECIFICATIONS - exact temperature ranges, humidity limits, storage conditions
            """
        ]
        
        pdf_bytes = self.read_pdf_file(pdf_path)
        pdf_base64 = base64.b64encode(pdf_bytes).decode('utf-8')
        
        followup_responses = []
        
        for question in followup_questions:
            try:
                response = self.client.messages.create(
                    model="claude-3-5-sonnet-20241022",
                    max_tokens=4000,
                    temperature=0.1,
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
                logger.warning(f"Follow-up question failed: {e}")
                followup_responses.append(f"Follow-up failed: {e}")
        
        # Combine all responses
        combined_response = initial_response["raw_response"]
        combined_response += "\n\n" + "="*60 + "\n"
        combined_response += "FOLLOW-UP ANALYSIS - ADDITIONAL DETAILS\n"
        combined_response += "="*60 + "\n\n"
        
        for i, followup in enumerate(followup_responses, 1):
            combined_response += f"\n--- Follow-up Analysis {i} ---\n"
            combined_response += followup + "\n"
        
        return {
            "raw_response": combined_response,
            "analysis_successful": True,
            "error": None,
            "initial_response": initial_response["raw_response"],
            "followup_responses": followup_responses
        }

    def parse_claude_response(self, raw_response: str, pdf_path: str) -> Dict[str, Any]:
        """Parse Claude's response into comprehensive structured JSON format"""
        
        # Initialize comprehensive structured output
        structured_output = {
            "metadata": {
                "datasheet_file": Path(pdf_path).name,
                "analysis_timestamp": datetime.now().isoformat(),
                "analyzer_version": "2.0.0",
                "analysis_successful": True,
                "analysis_type": "comprehensive_hardware_analysis"
            },
            "component_identification": {
                "component_name": "",
                "part_number": "",
                "component_type": "",
                "controller_ic": "",
                "technology": "",
                "version_variants": []
            },
            "technical_specifications": {
                "resolution": "",
                "display_size": "",
                "physical_dimensions": {
                    "display_dimensions": "",
                    "driver_board_dimensions": "",
                    "outline_dimensions": "",
                    "thickness": ""
                },
                "electrical_specs": {
                    "operating_voltage": "",
                    "standby_current": "",
                    "refresh_power": "",
                    "voltage_range": "",
                    "current_consumption": {}
                },
                "performance_specs": {
                    "refresh_time": "",
                    "viewing_angle": "",
                    "dot_pitch": "",
                    "display_colors": "",
                    "grayscale_levels": "",
                    "lifetime_cycles": ""
                },
                "environmental_conditions": {
                    "working_temperature": "",
                    "working_humidity": "",
                    "storage_temperature": "",
                    "storage_humidity": "",
                    "storage_time": "",
                    "transportation_conditions": ""
                }
            },
            "interfaces": {
                "primary_interfaces": [],
                "communication_protocol": "",
                "spi_configuration": {
                    "spi_mode": "",
                    "clock_polarity": "",
                    "clock_phase": "",
                    "data_format": ""
                },
                "pin_definitions": [],
                "connection_tables": {
                    "raspberry_pi": [],
                    "arduino": [],
                    "stm32": [],
                    "jetson_nano": [],
                    "other_platforms": []
                },
                "timing_requirements": [],
                "signal_integrity": {
                    "max_cable_length": "",
                    "connector_specifications": [],
                    "level_conversion": ""
                }
            },
            "critical_precautions": {
                "power_management_warnings": [],
                "refresh_constraints": [],
                "physical_handling": [],
                "environmental_limitations": [],
                "initialization_requirements": [],
                "damage_risks": []
            },
            "development_guidance": {
                "supported_platforms": [],
                "software_libraries": {
                    "c_libraries": [],
                    "python_libraries": [],
                    "installation_commands": []
                },
                "demo_code": {
                    "repository_url": "",
                    "archive_name": "",
                    "compilation_instructions": [],
                    "file_paths": []
                },
                "testing_procedures": [],
                "troubleshooting": []
            },
            "register_control": {
                "register_addresses": [],
                "control_commands": [],
                "initialization_sequences": [],
                "grayscale_mappings": [],
                "waveform_information": []
            },
            "extraction_analysis": {
                "successfully_extracted": [],
                "partially_extracted": [],
                "cannot_extract": [],
                "missing_documents": [],
                "future_processing_requirements": []
            },
            "raw_analysis": {
                "full_claude_response": raw_response,
                "response_length": len(raw_response),
                "analysis_sections": []
            }
        }
        
        # Parse the response text to extract structured information
        self._parse_component_identification(raw_response, structured_output)
        self._parse_technical_specifications(raw_response, structured_output)
        self._parse_interface_information(raw_response, structured_output)
        self._parse_pin_definitions(raw_response, structured_output)
        self._parse_connection_tables(raw_response, structured_output)
        self._parse_precautions(raw_response, structured_output)
        self._parse_development_info(raw_response, structured_output)
        self._parse_register_info(raw_response, structured_output)
        self._parse_extraction_limitations(raw_response, structured_output)
        
        return structured_output
    
    def _parse_component_identification(self, response: str, output: Dict):
        """Extract component identification information"""
        lines = response.split('\n')
        
        # Look for component name
        for line in lines:
            if any(keyword in line.lower() for keyword in ['component name', 'part number', 'component:']):
                if ':' in line:
                    output["component_identification"]["component_name"] = line.split(':', 1)[1].strip()
                    break
        
        # Extract part numbers and technology
        if 'uc8176' in response.lower():
            output["component_identification"]["controller_ic"] = "UC8176"
        
        if 'electrophoretic' in response.lower():
            output["component_identification"]["technology"] = "Electrophoretic Display (EPD)"
        
        # Extract version information
        if 'v2' in response.lower() or 'version' in response.lower():
            output["component_identification"]["version_variants"] = ["V1", "V2"]
    
    def _parse_technical_specifications(self, response: str, output: Dict):
        """Extract detailed technical specifications"""
        
        # Resolution
        resolution_patterns = [
            r'(\d+)\s*[×x]\s*(\d+)\s*pixels?',
            r'resolution[:\s]*(\d+)\s*[×x]\s*(\d+)',
            r'(\d+)\s*[×x]\s*(\d+)\s*resolution'
        ]
        for pattern in resolution_patterns:
            match = re.search(pattern, response, re.IGNORECASE)
            if match:
                output["technical_specifications"]["resolution"] = f"{match.group(1)} × {match.group(2)} pixels"
                break
        
        # Display size
        size_match = re.search(r'(\d+\.?\d*)\s*inch', response, re.IGNORECASE)
        if size_match:
            output["technical_specifications"]["display_size"] = f"{size_match.group(1)} inches"
        
        # Dot pitch
        dot_pitch_match = re.search(r'dot\s*pitch[:\s]*(\d+\.?\d*)\s*mm\s*[×x]\s*(\d+\.?\d*)\s*mm', response, re.IGNORECASE)
        if dot_pitch_match:
            output["technical_specifications"]["performance_specs"]["dot_pitch"] = f"{dot_pitch_match.group(1)}mm × {dot_pitch_match.group(2)}mm"
        
        # Physical dimensions - more comprehensive extraction
        dimensions = {}
        
        # Display dimensions
        display_dim_match = re.search(r'display\s*dimensions[:\s]*(\d+\.?\d*)\s*mm\s*[×x]\s*(\d+\.?\d*)\s*mm', response, re.IGNORECASE)
        if display_dim_match:
            dimensions["display_dimensions"] = f"{display_dim_match.group(1)}mm × {display_dim_match.group(2)}mm"
        
        # Driver board dimensions
        driver_dim_match = re.search(r'driver\s*board\s*dimensions[:\s]*(\d+\.?\d*)\s*mm\s*[×x]\s*(\d+\.?\d*)\s*mm', response, re.IGNORECASE)
        if driver_dim_match:
            dimensions["driver_board_dimensions"] = f"{driver_dim_match.group(1)}mm × {driver_dim_match.group(2)}mm"
        
        # Outline dimensions
        outline_dim_match = re.search(r'outline\s*dimensions[:\s]*(\d+\.?\d*)\s*mm\s*[×x]\s*(\d+\.?\d*)\s*mm\s*[×x]\s*(\d+\.?\d*)\s*mm', response, re.IGNORECASE)
        if outline_dim_match:
            dimensions["outline_dimensions"] = f"{outline_dim_match.group(1)}mm × {outline_dim_match.group(2)}mm × {outline_dim_match.group(3)}mm"
        
        if dimensions:
            output["technical_specifications"]["physical_dimensions"] = dimensions
        
        # Electrical specifications - enhanced extraction
        electrical = {}
        
        # Voltage specifications
        voltage_patterns = [
            (r'operating\s*voltage[:\s]*([^,\n]+)', 'operating_voltage'),
            (r'rated\s*input\s*voltage[:\s]*([^,\n]+)', 'rated_input_voltage'),
            (r'minimum\s*voltage[:\s]*([^,\n]+)', 'minimum_voltage'),
            (r'working\s*voltage[:\s]*([^,\n]+)', 'working_voltage')
        ]
        
        for pattern, key in voltage_patterns:
            match = re.search(pattern, response, re.IGNORECASE)
            if match:
                electrical[key] = match.group(1).strip()
        
        # Current specifications
        current_patterns = [
            (r'standby\s*current[:\s]*([^,\n]+)', 'standby_current'),
            (r'refresh\s*power[:\s]*([^,\n]+)', 'refresh_power'),
            (r'power\s*consumption[:\s]*([^,\n]+)', 'power_consumption')
        ]
        
        for pattern, key in current_patterns:
            match = re.search(pattern, response, re.IGNORECASE)
            if match:
                electrical[key] = match.group(1).strip()
        
        if electrical:
            output["technical_specifications"]["electrical_specs"] = electrical
        
        # Performance specifications - enhanced
        performance = {}
        
        # Refresh time
        refresh_match = re.search(r'refresh\s*time[:\s]*(\d+\.?\d*)\s*s', response, re.IGNORECASE)
        if refresh_match:
            performance["refresh_time"] = f"{refresh_match.group(1)} seconds"
        
        # Viewing angle
        viewing_match = re.search(r'viewing\s*angle[:\s]*(\d+)\s*degrees?', response, re.IGNORECASE)
        if viewing_match:
            performance["viewing_angle"] = f"{viewing_match.group(1)} degrees"
        
        # Display colors
        color_match = re.search(r'display\s*colors?[:\s]*([^,\n]+)', response, re.IGNORECASE)
        if color_match:
            performance["display_colors"] = color_match.group(1).strip()
        
        # Grayscale levels
        grayscale_match = re.search(r'grayscale?\s*levels?[:\s]*(\d+)', response, re.IGNORECASE)
        if grayscale_match:
            performance["grayscale_levels"] = grayscale_match.group(1)
        
        # Lifetime
        lifetime_match = re.search(r'lifetime[:\s]*([^,\n]+)', response, re.IGNORECASE)
        if lifetime_match:
            performance["lifetime_cycles"] = lifetime_match.group(1).strip()
        
        if performance:
            output["technical_specifications"]["performance_specs"] = performance
        
        # Environmental conditions - comprehensive
        environmental = {}
        
        # Temperature ranges
        temp_patterns = [
            (r'working\s*temperature[:\s]*([^,\n]+)', 'working_temperature'),
            (r'storage\s*temperature[:\s]*([^,\n]+)', 'storage_temperature'),
            (r'transportation\s*temperature[:\s]*([^,\n]+)', 'transportation_temperature'),
            (r'operating.*temperature[:\s]*([^,\n]+)', 'operating_temperature')
        ]
        
        for pattern, key in temp_patterns:
            match = re.search(pattern, response, re.IGNORECASE)
            if match:
                environmental[key] = match.group(1).strip()
        
        # Humidity ranges
        humidity_patterns = [
            (r'working\s*humidity[:\s]*([^,\n]+)', 'working_humidity'),
            (r'storage\s*humidity[:\s]*([^,\n]+)', 'storage_humidity')
        ]
        
        for pattern, key in humidity_patterns:
            match = re.search(pattern, response, re.IGNORECASE)
            if match:
                environmental[key] = match.group(1).strip()
        
        # Storage and transportation conditions
        if 'storage time' in response.lower():
            storage_match = re.search(r'storage\s*time[:\s]*([^,\n]+)', response, re.IGNORECASE)
            if storage_match:
                environmental['storage_time'] = storage_match.group(1).strip()
        
        if 'transportation' in response.lower():
            transport_match = re.search(r'transportation.*time[:\s]*([^,\n]+)', response, re.IGNORECASE)
            if transport_match:
                environmental['transportation_time'] = transport_match.group(1).strip()
        
        if environmental:
            output["technical_specifications"]["environmental_conditions"] = environmental
    
    def _parse_interface_information(self, response: str, output: Dict):
        """Extract interface and communication details"""
        
        # Primary interfaces
        interfaces = []
        if 'spi' in response.lower():
            interfaces.append("SPI")
            output["interfaces"]["communication_protocol"] = "SPI"
        if 'i2c' in response.lower():
            interfaces.append("I2C")
        if 'uart' in response.lower():
            interfaces.append("UART")
        
        output["interfaces"]["primary_interfaces"] = interfaces
        
        # SPI configuration
        if 'cphl=0' in response.lower() and 'cpol=0' in response.lower():
            output["interfaces"]["spi_configuration"] = {
                "spi_mode": "Mode 0",
                "clock_polarity": "CPOL=0",
                "clock_phase": "CPHL=0",
                "data_format": "MSB first"
            }
        
        # Signal integrity
        if '20cm' in response:
            output["interfaces"]["signal_integrity"]["max_cable_length"] = "20cm maximum"
        
        if '2.54mm' in response or '0.1 inch' in response:
            output["interfaces"]["signal_integrity"]["connector_specifications"] = ["0.1 inch (2.54mm) pitch"]
    
    def _parse_pin_definitions(self, response: str, output: Dict):
        """Extract detailed pin definitions"""
        
        # Common pin patterns
        pin_patterns = [
            (r'CSB?\s*\(CS\)', 'CS', 'Chip Select', 'CHIP_SELECT'),
            (r'SCL\s*\(SCK/SCLK\)', 'SCL', 'SPI Clock', 'CLOCK'),
            (r'D/C\s*\(DC\)', 'DC', 'Data/Command Control', 'CONTROL'),
            (r'SDA\s*\(DIN\)', 'SDA', 'Serial Data', 'DATA'),
            (r'VCC', 'VCC', 'Power Supply', 'POWER'),
            (r'GND', 'GND', 'Ground', 'GROUND'),
            (r'RST', 'RST', 'Reset', 'RESET'),
            (r'BUSY', 'BUSY', 'Status Indicator', 'STATUS')
        ]
        
        pins = []
        for pattern, name, description, pin_type in pin_patterns:
            if re.search(pattern, response, re.IGNORECASE):
                # Extract more detailed description from context
                detailed_desc = self._extract_pin_description(response, name)
                pins.append({
                    "pin_name": name,
                    "pin_type": pin_type,
                    "description": detailed_desc or description,
                    "voltage_logic": "TTL/CMOS compatible",
                    "alternate_names": self._extract_alternate_names(response, name)
                })
        
        output["interfaces"]["pin_definitions"] = pins
    
    def _parse_connection_tables(self, response: str, output: Dict):
        """Extract connection tables for different platforms with enhanced parsing"""
        
        platforms = {
            "raspberry_pi": ["raspberry pi", "rpi", "bcm"],
            "arduino": ["arduino", "uno", "mega"],
            "stm32": ["stm32"],
            "jetson_nano": ["jetson", "nano"],
            "esp32": ["esp32"],
            "esp8266": ["esp8266"]
        }
        
        # Split response into sections for better parsing
        sections = self._split_into_sections(response)
        
        for platform, keywords in platforms.items():
            connections = []
            
            # Find the relevant section for this platform
            platform_section = ""
            for section in sections:
                if any(keyword in section.lower() for keyword in keywords):
                    platform_section = section
                    break
            
            if not platform_section:
                continue
            
            # Extract table data using multiple methods
            
            # Method 1: Parse markdown-style tables
            connections.extend(self._parse_markdown_table(platform_section, platform))
            
            # Method 2: Parse structured text patterns
            connections.extend(self._parse_connection_patterns(platform_section, platform))
            
            # Method 3: Parse list-style connections
            connections.extend(self._parse_connection_lists(platform_section, platform))
            
            if connections:
                output["interfaces"]["connection_tables"][platform] = connections[:15]  # Limit to reasonable number
    
    def _split_into_sections(self, response: str) -> List[str]:
        """Split response into logical sections based on headers"""
        sections = []
        current_section = ""
        
        for line in response.split('\n'):
            # Check if this looks like a header
            if (line.strip() and 
                (line.isupper() or 
                 line.startswith('#') or 
                 line.startswith('##') or
                 'Connection' in line or
                 'Working With' in line)):
                
                if current_section:
                    sections.append(current_section)
                current_section = line + '\n'
            else:
                current_section += line + '\n'
        
        if current_section:
            sections.append(current_section)
        
        return sections
    
    def _parse_markdown_table(self, section: str, platform: str) -> List[Dict]:
        """Parse markdown-style tables"""
        connections = []
        lines = section.split('\n')
        
        table_started = False
        headers = []
        
        for line in lines:
            if '|' in line and len(line.split('|')) >= 3:
                parts = [part.strip() for part in line.split('|')]
                parts = [p for p in parts if p]  # Remove empty parts
                
                if not table_started:
                    # This might be a header
                    if any(word in ' '.join(parts).lower() for word in ['pin', 'connection', 'gpio']):
                        headers = parts
                        table_started = True
                    continue
                
                # Skip separator lines
                if all(set(part) <= set('-| ') for part in parts):
                    continue
                
                if len(parts) >= 2:
                    connection = {
                        "e_paper_pin": parts[0],
                        "platform_pin": parts[1],
                        "platform": platform
                    }
                    
                    if len(parts) > 2:
                        connection["pin_number"] = parts[2]
                    if len(parts) > 3:
                        connection["board_pin"] = parts[3]
                    
                    connections.append(connection)
        
        return connections
    
    def _parse_connection_patterns(self, section: str, platform: str) -> List[Dict]:
        """Parse connection patterns like 'VCC -> 3.3V' or 'DIN -> MOSI'"""
        connections = []
        
        # Common connection patterns
        patterns = [
            r'(\w+)\s*(?:->|→|:)\s*(\w+(?:\d+)?)',  # VCC -> 3.3V
            r'(\w+)\s+(\w+(?:\d+)?)\s+(\d+)',        # DIN MOSI 19
            r'(\w+)\s*\|\s*(\w+(?:\d+)?)\s*\|\s*(\d+)', # VCC | 3.3V | -
        ]
        
        for pattern in patterns:
            matches = re.findall(pattern, section)
            for match in matches:
                if len(match) >= 2:
                    connection = {
                        "e_paper_pin": match[0],
                        "platform_pin": match[1],
                        "platform": platform
                    }
                    if len(match) > 2:
                        connection["pin_number"] = match[2]
                    
                    connections.append(connection)
        
        return connections
    
    def _parse_connection_lists(self, section: str, platform: str) -> List[Dict]:
        """Parse list-style connections"""
        connections = []
        lines = section.split('\n')
        
        for line in lines:
            # Look for patterns like "VCC: 3.3V" or "DIN: D11"
            if ':' in line and any(pin in line.upper() for pin in ['VCC', 'GND', 'DIN', 'CLK', 'CS', 'DC', 'RST', 'BUSY']):
                parts = line.split(':', 1)
                if len(parts) == 2:
                    e_paper_pin = parts[0].strip()
                    platform_info = parts[1].strip()
                    
                    connection = {
                        "e_paper_pin": e_paper_pin,
                        "platform_pin": platform_info,
                        "platform": platform
                    }
                    connections.append(connection)
        
        return connections
    
    def _parse_precautions(self, response: str, output: Dict):
        """Extract critical precautions and warnings with enhanced pattern matching"""
        
        # Enhanced warning extraction with specific timing requirements
        timing_constraints = []
        
        # Minimum refresh interval
        refresh_interval_match = re.search(r'minimum\s*refresh\s*interval[:\s]*(\d+)\s*seconds?', response, re.IGNORECASE)
        if refresh_interval_match:
            timing_constraints.append(f"Minimum refresh interval: {refresh_interval_match.group(1)} seconds")
        
        # 24-hour refresh requirement
        if '24 hour' in response.lower() or 'once every 24' in response.lower():
            refresh_24h_match = re.search(r'refresh.*least.*once.*every.*24.*hours?', response, re.IGNORECASE)
            if refresh_24h_match:
                timing_constraints.append("Must refresh at least once every 24 hours")
            else:
                timing_constraints.append("Requires refresh at least once every 24 hours")
        
        # 180 second requirement
        if '180' in response and 'second' in response:
            timing_constraints.append("Minimum 180 seconds between refreshes")
        
        output["critical_precautions"]["timing_constraints"] = timing_constraints
        
        # Power management warnings - enhanced
        power_warnings = []
        power_keywords = [
            (r'never.*power.*on.*long', 'Never power on for extended periods'),
            (r'do not.*power.*long', 'Do not power on for long periods without refreshing'),
            (r'high voltage.*damage', 'High voltage state for long periods causes damage'),
            (r'sleep mode.*after.*refresh', 'Set to sleep mode after refresh operations'),
            (r'voltage.*below.*2\.5V', 'Never go below 2.5V supply voltage')
        ]
        
        for pattern, warning in power_keywords:
            if re.search(pattern, response, re.IGNORECASE):
                power_warnings.append(warning)
        
        # Extract additional power warnings from bullet points
        lines = response.split('\n')
        for line in lines:
            line_lower = line.lower()
            if any(keyword in line_lower for keyword in ['power', 'voltage', 'vcc', 'supply']):
                if any(warning_word in line_lower for warning_word in ['never', 'do not', 'avoid', 'critical', 'damage']):
                    if len(line.strip()) > 15:
                        power_warnings.append(line.strip())
        
        output["critical_precautions"]["power_management_warnings"] = power_warnings[:10]
        
        # Refresh constraints - specific patterns
        refresh_constraints = []
        refresh_patterns = [
            (r'partial.*refresh.*cannot.*continuous', 'Cannot use partial refresh continuously'),
            (r'full.*refresh.*after.*partial', 'Must perform full refresh after several partial refreshes'),
            (r'abnormal.*display.*effect', 'Improper refresh causes abnormal display effects'),
            (r'flickering.*global.*refresh', 'Flickering during global refresh is normal')
        ]
        
        for pattern, constraint in refresh_patterns:
            if re.search(pattern, response, re.IGNORECASE):
                refresh_constraints.append(constraint)
        
        output["critical_precautions"]["refresh_constraints"] = refresh_constraints
        
        # Physical handling - enhanced
        physical_warnings = []
        physical_patterns = [
            (r'fpc.*cable.*fragile', 'FPC cable is fragile - handle carefully'),
            (r'do not.*bend.*vertical', 'Do not bend cable vertically to screen'),
            (r'avoid.*repeated.*bending', 'Avoid repeated excessive bending'),
            (r'screen.*fragile', 'Screen is fragile - avoid impacts'),
            (r'fixed.*wiring.*development', 'Use fixed wiring during development')
        ]
        
        for pattern, warning in physical_patterns:
            if re.search(pattern, response, re.IGNORECASE):
                physical_warnings.append(warning)
        
        output["critical_precautions"]["physical_handling"] = physical_warnings
        
        # Environmental limitations
        environmental_limits = []
        env_patterns = [
            (r'uv.*exposure.*permanent', 'UV exposure causes permanent damage'),
            (r'direct.*sunlight.*avoid', 'Avoid direct sunlight'),
            (r'indoor.*use.*recommended', 'Indoor use recommended'),
            (r'temperature.*range', 'Operating temperature limits must be observed')
        ]
        
        for pattern, limit in env_patterns:
            if re.search(pattern, response, re.IGNORECASE):
                environmental_limits.append(limit)
        
        output["critical_precautions"]["environmental_limitations"] = environmental_limits
        
        # Damage risks - specific extraction
        damage_risks = []
        damage_patterns = [
            (r'irreversible.*damage', 'Certain conditions cause irreversible damage'),
            (r'permanent.*damage', 'Risk of permanent damage exists'),
            (r'cannot.*repair', 'Some damage cannot be repaired'),
            (r'burn.*out', 'Screen can burn out if misused')
        ]
        
        for pattern, risk in damage_patterns:
            if re.search(pattern, response, re.IGNORECASE):
                damage_risks.append(risk)
        
        output["critical_precautions"]["damage_risks"] = damage_risks
    
    def _parse_development_info(self, response: str, output: Dict):
        """Extract development and implementation information"""
        
        # Extract supported platforms
        platforms = []
        platform_keywords = ["raspberry pi", "arduino", "stm32", "jetson nano", "esp32", "esp8266"]
        for keyword in platform_keywords:
            if keyword in response.lower():
                platforms.append(keyword.title())
        
        output["development_guidance"]["supported_platforms"] = platforms
        
        # Extract libraries
        c_libs = []
        python_libs = []
        
        lib_patterns = {
            "c_libraries": ["bcm2835", "wiringpi", "gpiod", "lg"],
            "python_libraries": ["rpi.gpio", "spidev", "pil", "numpy", "gpiozero"]
        }
        
        for lib_type, libs in lib_patterns.items():
            found_libs = []
            for lib in libs:
                if lib in response.lower():
                    found_libs.append(lib)
            output["development_guidance"]["software_libraries"][lib_type] = found_libs
        
        # Extract repository information
        if "github.com" in response:
            repo_match = re.search(r'(https://github\.com/[^\s]+)', response)
            if repo_match:
                output["development_guidance"]["demo_code"]["repository_url"] = repo_match.group(1)
    
    def _parse_register_info(self, response: str, output: Dict):
        """Extract register and control information"""
        
        # Extract register addresses
        register_matches = re.findall(r'0x([0-9A-Fa-f]+)', response)
        if register_matches:
            output["register_control"]["register_addresses"] = [f"0x{reg}" for reg in register_matches]
        
        # Extract grayscale mappings
        if 'black:' in response.lower() and '00b' in response:
            output["register_control"]["grayscale_mappings"] = [
                {"color": "Black", "value": "00b"},
                {"color": "Dark Grey", "value": "01b"},
                {"color": "Light Gray", "value": "10b"},
                {"color": "White", "value": "11b"}
            ]
    
    def _parse_extraction_limitations(self, response: str, output: Dict):
        """Extract information about analysis limitations"""
        
        limitation_categories = {
            "successfully_extracted": ["successfully extracted", "can read", "extracted"],
            "cannot_extract": ["cannot extract", "cannot read", "visual elements", "diagrams"],
            "missing_documents": ["external document", "datasheet", "schematic", "missing"]
        }
        
        for category, keywords in limitation_categories.items():
            items = []
            for line in response.split('\n'):
                if any(keyword in line.lower() for keyword in keywords):
                    if len(line.strip()) > 10:  # Filter out very short lines
                        items.append(line.strip())
            
            output["extraction_analysis"][category] = items[:15]  # Limit to top 15
    
    def _extract_pin_description(self, response: str, pin_name: str) -> str:
        """Extract detailed description for a specific pin"""
        lines = response.split('\n')
        for i, line in enumerate(lines):
            if pin_name.lower() in line.lower() and ':' in line:
                # Try to get the full description, possibly spanning multiple lines
                description = line.split(':', 1)[1].strip()
                if description:
                    return description
        return ""
    
    def _extract_alternate_names(self, response: str, pin_name: str) -> List[str]:
        """Extract alternate names for a pin"""
        # Look for patterns like "CSB (CS)" or "SCL (SCK/SCLK)"
        pattern = rf'{pin_name}\s*\(([^)]+)\)'
        matches = re.findall(pattern, response, re.IGNORECASE)
        if matches:
            # Split on common delimiters
            alternates = re.split(r'[/,\s]+', matches[0])
            return [alt.strip() for alt in alternates if alt.strip()]
        return []
    
    def _extract_platform_connections(self, response: str, platform: str) -> List[Dict]:
        """Enhanced platform connection extraction"""
        return self._parse_connection_patterns(response, platform)

    def save_results(self, results: Dict[str, Any], output_path: str):
        """Save analysis results to JSON file"""
        try:
            with open(output_path, 'w', encoding='utf-8') as f:
                json.dump(results, f, indent=2, ensure_ascii=False)
            logger.info(f"Results saved to {output_path}")
        except Exception as e:
            logger.error(f"Error saving results: {e}")
            raise

    def generate_summary_report(self, results: Dict[str, Any]) -> str:
        """Generate a human-readable summary report"""
        
        report = []
        report.append("=" * 60)
        report.append("DATASHEET ANALYSIS SUMMARY")
        report.append("=" * 60)
        
        # Component info
        component_name = results.get("component_identification", {}).get("component_name", "")
        if not component_name:
            # Fallback to old structure
            component_name = results.get("device_information", {}).get("component_name", "Unknown Component")
        
        if component_name:
            report.append(f"\nComponent: {component_name}")
        
        # Interfaces
        interfaces = results.get("interfaces", {}).get("primary_interfaces", [])
        if interfaces:
            report.append(f"\nPrimary Interfaces: {', '.join(interfaces)}")
        
        # Technical specifications
        tech_specs = results.get("technical_specifications", {})
        if tech_specs:
            report.append(f"\nTechnical Specifications:")
            if tech_specs.get("resolution"):
                report.append(f"  • Resolution: {tech_specs['resolution']}")
            
            electrical = tech_specs.get("electrical_specs", {})
            if electrical.get("operating_voltage"):
                report.append(f"  • Operating Voltage: {electrical['operating_voltage']}")
            if electrical.get("standby_current"):
                report.append(f"  • Standby Current: {electrical['standby_current']}")
        
        # Pin definitions
        pins = results.get("interfaces", {}).get("pin_definitions", [])
        if pins:
            report.append(f"\nPin Definitions ({len(pins)} pins):")
            for pin in pins[:5]:  # Show first 5 pins
                pin_type = pin.get("pin_type", "")
                description = pin.get("description", "")
                report.append(f"  • {pin.get('pin_name', 'Unknown')} ({pin_type}): {description}")
            if len(pins) > 5:
                report.append(f"  ... and {len(pins) - 5} more pins")
        
        # Critical warnings
        warnings = results.get("critical_precautions", {}).get("power_management_warnings", [])
        if not warnings:
            # Fallback to old structure
            warnings = results.get("precautions_and_constraints", {}).get("critical_warnings", [])
        
        if warnings:
            report.append(f"\n🚨 CRITICAL WARNINGS ({len(warnings)} found):")
            for warning in warnings[:5]:  # Top 5 warnings
                report.append(f"  • {warning}")
            if len(warnings) > 5:
                report.append(f"  ... and {len(warnings) - 5} more warnings")
        
        # Development platforms
        platforms = results.get("development_guidance", {}).get("supported_platforms", [])
        if platforms:
            report.append(f"\nSupported Platforms: {', '.join(platforms)}")
        
        # Limitations
        limitations = results.get("extraction_analysis", {}).get("cannot_extract", [])
        if not limitations:
            # Fallback to old structure
            limitations = results.get("extraction_limitations", {}).get("missing_visual_elements", [])
        
        if limitations:
            report.append(f"\n⚠️  EXTRACTION LIMITATIONS ({len(limitations)} found):")
            for limitation in limitations[:5]:  # Top 5 limitations
                report.append(f"  • {limitation}")
            if len(limitations) > 5:
                report.append(f"  ... and {len(limitations) - 5} more limitations")
        
        # Analysis metadata
        metadata = results.get("metadata", {})
        if metadata.get("analysis_successful", True):
            report.append(f"\n✅ Analysis completed successfully")
            if metadata.get("analysis_method"):
                report.append(f"   Method: {metadata['analysis_method']}")
            if metadata.get("token_usage"):
                usage = metadata["token_usage"]
                report.append(f"   Token usage: {usage.get('input_tokens', 0)} input, {usage.get('output_tokens', 0)} output")
        else:
            report.append(f"\n❌ Analysis failed")
            if metadata.get("error"):
                report.append(f"   Error: {metadata['error']}")
        
        # File information
        report.append(f"\nFiles generated:")
        if metadata.get("raw_response_file"):
            report.append(f"  • Raw response: {metadata['raw_response_file']}")
        
        report.append(f"\nAnalyzed on: {metadata.get('analysis_timestamp', 'Unknown')}")
        report.append("=" * 60)
        
        return "\n".join(report)

    def analyze_and_save(self, pdf_path: str, output_dir: str = "output", use_followup: bool = True) -> Dict[str, Any]:
        """Complete analysis workflow with optional follow-up analysis"""
        
        # Create output directory
        Path(output_dir).mkdir(exist_ok=True)
        
        # Generate output filenames
        pdf_name = Path(pdf_path).stem
        json_output = Path(output_dir) / f"{pdf_name}_analysis.json"
        summary_output = Path(output_dir) / f"{pdf_name}_summary.txt"
        raw_output = Path(output_dir) / f"{pdf_name}_raw_response.txt"
        
        try:
            # Choose analysis method
            if use_followup:
                logger.info("Using comprehensive analysis with follow-up questions...")
                claude_response = self.analyze_with_followup(pdf_path)
            else:
                logger.info("Using single-pass analysis...")
                claude_response = self.analyze_datasheet(pdf_path)
            
            if not claude_response["analysis_successful"]:
                logger.error(f"Analysis failed: {claude_response['error']}")
                return {"success": False, "error": claude_response['error']}
            
            # Save raw response to separate file
            self.save_raw_response(claude_response["raw_response"], str(raw_output))
            
            # Parse response into structured format
            structured_results = self.parse_claude_response(
                claude_response["raw_response"], 
                pdf_path
            )
            
            # Add additional metadata
            structured_results["metadata"]["analysis_method"] = "follow-up" if use_followup else "single-pass"
            structured_results["metadata"]["raw_response_file"] = str(raw_output)
            if claude_response.get("usage"):
                structured_results["metadata"]["token_usage"] = claude_response["usage"]
            
            # Add followup response information if available
            if use_followup and "followup_responses" in claude_response:
                structured_results["metadata"]["followup_count"] = len(claude_response["followup_responses"])
                structured_results["raw_analysis"]["initial_response_length"] = len(claude_response.get("initial_response", ""))
                structured_results["raw_analysis"]["followup_responses_length"] = [
                    len(response) for response in claude_response["followup_responses"]
                ]
            
            # Update metadata with any errors
            if claude_response.get("error"):
                structured_results["metadata"]["analysis_successful"] = False
                structured_results["metadata"]["error"] = claude_response["error"]
            
            # Remove raw response from JSON to keep it clean (now saved separately)
            structured_results["raw_analysis"]["full_claude_response"] = "[Saved to separate raw response file]"
            structured_results["raw_analysis"]["raw_response_file"] = str(raw_output)
            
            # Save structured results
            self.save_results(structured_results, str(json_output))
            
            # Generate and save summary
            summary = self.generate_summary_report(structured_results)
            with open(summary_output, 'w', encoding='utf-8') as f:
                f.write(summary)
            
            logger.info(f"Analysis completed successfully!")
            logger.info(f"JSON results: {json_output}")
            logger.info(f"Summary report: {summary_output}")
            logger.info(f"Raw response: {raw_output}")
            print(summary)  # Display summary to user
            
            return {
                "success": True,
                "json_output": str(json_output),
                "summary_output": str(summary_output),
                "raw_output": str(raw_output),
                "results": structured_results
            }
            
        except Exception as e:
            logger.error(f"Analysis workflow failed: {e}")
            return {"success": False, "error": str(e)}

    def save_raw_response(self, raw_response: str, output_path: str):
        """Save the raw Claude response to a separate text file with metadata"""
        try:
            with open(output_path, 'w', encoding='utf-8') as f:
                # Add header with metadata
                f.write("=" * 80 + "\n")
                f.write("CLAUDE AI DATASHEET ANALYSIS - RAW RESPONSE\n")
                f.write("=" * 80 + "\n")
                f.write(f"Generated: {datetime.now().isoformat()}\n")
                f.write(f"Analyzer Version: 2.0.0\n")
                f.write(f"Response Length: {len(raw_response)} characters\n")
                f.write("=" * 80 + "\n\n")
                
                # Write the raw response
                f.write(raw_response)
                
                # Add footer
                f.write("\n\n" + "=" * 80 + "\n")
                f.write("END OF RAW RESPONSE\n")
                f.write("=" * 80 + "\n")
            
            logger.info(f"Raw response saved to {output_path}")
        except Exception as e:
            logger.error(f"Error saving raw response: {e}")
            raise

def main():
    """Command line interface"""
    parser = argparse.ArgumentParser(
        description="Analyze datasheets using Claude AI",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
    python datasheet_analyzer.py datasheet.pdf
    python datasheet_analyzer.py datasheet.pdf --output-dir ./analysis_results
    python datasheet_analyzer.py datasheet.pdf --api-key your_api_key_here

Environment Variables:
    ANTHROPIC_API_KEY: Your Claude API key (required if not passed via --api-key)
        """
    )
    
    parser.add_argument(
        "pdf_path",
        help="Path to the PDF datasheet file"
    )
    
    parser.add_argument(
        "--output-dir",
        default="output",
        help="Output directory for results (default: output)"
    )
    
    parser.add_argument(
        "--api-key",
        help="Anthropic API key (overrides ANTHROPIC_API_KEY env var)"
    )
    
    parser.add_argument(
        "--comprehensive", "-c",
        action="store_true",
        help="Use comprehensive analysis with follow-up questions (slower but more detailed)"
    )
    
    parser.add_argument(
        "--single-pass", "-s",
        action="store_true", 
        help="Use single-pass analysis only (faster but less detailed)"
    )
    
    parser.add_argument(
        "--verbose", "-v",
        action="store_true",
        help="Enable verbose logging"
    )
    
    args = parser.parse_args()
    
    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)
    
    # Determine analysis method
    use_followup = True  # Default to comprehensive analysis
    if args.single_pass:
        use_followup = False
    elif args.comprehensive:
        use_followup = True
    
    # Validate input file
    if not Path(args.pdf_path).exists():
        logger.error(f"Input file not found: {args.pdf_path}")
        return 1
    
    if not args.pdf_path.lower().endswith('.pdf'):
        logger.error(f"Input file must be a PDF: {args.pdf_path}")
        return 1
    
    try:
        # Initialize analyzer
        analyzer = DatasheetAnalyzer(api_key=args.api_key)
        
        # Run analysis
        result = analyzer.analyze_and_save(args.pdf_path, args.output_dir, use_followup=use_followup)
        
        if result["success"]:
            logger.info("Analysis completed successfully!")
            logger.info(f"JSON results: {result['json_output']}")
            logger.info(f"Summary report: {result['summary_output']}")
            return 0
        else:
            logger.error(f"Analysis failed: {result['error']}")
            return 1
            
    except Exception as e:
        logger.error(f"Unexpected error: {e}")
        return 1

if __name__ == "__main__":
    exit(main())


    # python llm-data-sheet-ingest.py ../datasheets/epaper.pdf --output-dir ../output --api-key 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 
    # python llm-data-sheet-ingest.py ../datasheets/epaper.pdf --output-dir ../output --api-key api_key
    # python llm-data-sheet-ingest.py ../datasheets/esp32_datasheet_en.pdf --output-dir ../output --api-key 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 