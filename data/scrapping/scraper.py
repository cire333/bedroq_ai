#!/usr/bin/env python3
"""
Datasheet Scraper for datasheets.com
Version: 1.0.0

This script scrapes datasheets from datasheets.com by:
1. Starting at the manufacturers page
2. Visiting each manufacturer's page
3. Collecting component URLs from each manufacturer
4. Downloading datasheets in batches
5. Logging all downloads to prevent re-downloads
"""

import argparse
import csv
import json
import logging
import os
import requests
import sys
import time
from datetime import datetime
from pathlib import Path
from urllib.parse import urljoin, urlparse
from typing import List, Dict, Set, Optional

import bs4
from bs4 import BeautifulSoup

# Script version
SCRIPT_VERSION = "1.1.0"

# Default settings
DEFAULT_BATCH_SIZE = 50
DEFAULT_DELAY = 1.0  # seconds between requests
DEFAULT_TIMEOUT = 30  # seconds
USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"

class DatasheetScraper:
    def __init__(self, output_dir: str, batch_size: int = DEFAULT_BATCH_SIZE, 
                 delay: float = DEFAULT_DELAY, timeout: int = DEFAULT_TIMEOUT,
                 manufacturer_filter: Optional[str] = None):
        self.output_dir = Path(output_dir)
        self.batch_size = batch_size
        self.delay = delay
        self.timeout = timeout
        self.manufacturer_filter = manufacturer_filter.upper() if manufacturer_filter else None
        self.session = requests.Session()
        self.session.headers.update({'User-Agent': USER_AGENT})
        
        # Create output directory
        self.output_dir.mkdir(parents=True, exist_ok=True)
        
        # Setup logging
        self.setup_logging()
        
        # Initialize log file and tracking
        self.log_file = self.output_dir / "download_log.csv"
        self.progress_file = self.output_dir / "scraper_progress.json"
        self.downloaded_urls = self.load_downloaded_urls()
        self.progress = self.load_progress()
        
        self.logger.info(f"Datasheet Scraper v{SCRIPT_VERSION} initialized")
        self.logger.info(f"Output directory: {self.output_dir}")
        self.logger.info(f"Batch size: {batch_size}")
        if self.manufacturer_filter:
            self.logger.info(f"Manufacturer filter: starts with '{self.manufacturer_filter}'")
        
        # Load or initialize progress
        if self.progress.get('last_completed_manufacturer'):
            self.logger.info(f"Resume mode: Last completed manufacturer: {self.progress['last_completed_manufacturer']}")
        if self.progress.get('current_manufacturer'):
            self.logger.info(f"Resume mode: Current manufacturer: {self.progress['current_manufacturer']}")
            if self.progress.get('last_completed_batch') is not None:
                self.logger.info(f"Resume mode: Last completed batch: {self.progress['last_completed_batch']}")
        
    def setup_logging(self):
        """Setup logging configuration"""
        log_file = self.output_dir / "scraper.log"
        
        # Create formatters
        file_formatter = logging.Formatter(
            '%(asctime)s - %(levelname)s - %(message)s'
        )
        console_formatter = logging.Formatter(
            '%(levelname)s: %(message)s'
        )
        
        # Setup logger
        self.logger = logging.getLogger('datasheet_scraper')
        self.logger.setLevel(logging.INFO)
        
        # File handler
        file_handler = logging.FileHandler(log_file)
        file_handler.setLevel(logging.INFO)
        file_handler.setFormatter(file_formatter)
        
        # Console handler
        console_handler = logging.StreamHandler()
        console_handler.setLevel(logging.INFO)
        console_handler.setFormatter(console_formatter)
        
        self.logger.addHandler(file_handler)
        self.logger.addHandler(console_handler)
        
    def load_progress(self) -> Dict:
        """Load scraping progress from JSON file"""
        default_progress = {
            'last_completed_manufacturer': None,
            'current_manufacturer': None,
            'last_completed_batch': None,
            'total_stats': {'success': 0, 'error': 0, 'skipped': 0},
            'last_updated': None
        }
        
        if self.progress_file.exists():
            try:
                with open(self.progress_file, 'r', encoding='utf-8') as f:
                    progress = json.load(f)
                    # Merge with defaults to handle version updates
                    for key in default_progress:
                        if key not in progress:
                            progress[key] = default_progress[key]
                    self.logger.info(f"Loaded progress from previous run")
                    return progress
            except Exception as e:
                self.logger.warning(f"Could not load progress file: {e}")
        
        return default_progress
    
    def save_progress(self, manufacturer_name: str = None, batch_number: int = None, 
                     completed_manufacturer: str = None, stats: Dict = None):
        """Save current scraping progress"""
        try:
            if stats:
                for key in stats:
                    self.progress['total_stats'][key] += stats[key]
            
            if completed_manufacturer:
                self.progress['last_completed_manufacturer'] = completed_manufacturer
                self.progress['current_manufacturer'] = None
                self.progress['last_completed_batch'] = None
            elif manufacturer_name:
                self.progress['current_manufacturer'] = manufacturer_name
                if batch_number is not None:
                    self.progress['last_completed_batch'] = batch_number
            
            self.progress['last_updated'] = datetime.now().isoformat()
            
            with open(self.progress_file, 'w', encoding='utf-8') as f:
                json.dump(self.progress, f, indent=2)
                
        except Exception as e:
            self.logger.error(f"Error saving progress: {e}")
    def load_downloaded_urls(self) -> Set[str]:
        """Load previously downloaded URLs from log file"""
        downloaded = set()
        if self.log_file.exists():
            try:
                with open(self.log_file, 'r', newline='', encoding='utf-8') as f:
                    reader = csv.DictReader(f)
                    for row in reader:
                        if row.get('status') == 'success':
                            downloaded.add(row.get('url', ''))
                self.logger.info(f"Loaded {len(downloaded)} previously downloaded URLs")
            except Exception as e:
                self.logger.error(f"Error loading download log: {e}")
        return downloaded
        
    def should_skip_manufacturer(self, manufacturer_name: str) -> bool:
        """Check if manufacturer should be skipped based on resume logic and filters"""
        # Apply manufacturer filter if specified
        if self.manufacturer_filter and not manufacturer_name.upper().startswith(self.manufacturer_filter):
            return True
            
        # Resume logic: skip manufacturers that were already completed
        if self.progress.get('last_completed_manufacturer'):
            # If we're in the middle of a manufacturer, only skip if it's before the current one
            if self.progress.get('current_manufacturer'):
                return manufacturer_name != self.progress['current_manufacturer']
            else:
                # We completed the last manufacturer, so skip all up to and including it
                return True  # We'll handle this in the main loop
        
        return False
        
    def log_download(self, url: str, filename: str, status: str, error_msg: str = ""):
        """Log download attempt to CSV file"""
        file_exists = self.log_file.exists()
        try:
            with open(self.log_file, 'a', newline='', encoding='utf-8') as f:
                fieldnames = ['timestamp', 'filename', 'url', 'status', 'script_version', 'error_message']
                writer = csv.DictWriter(f, fieldnames=fieldnames)
                
                if not file_exists:
                    writer.writeheader()
                
                writer.writerow({
                    'timestamp': datetime.now().isoformat(),
                    'filename': filename,
                    'url': url,
                    'status': status,
                    'script_version': SCRIPT_VERSION,
                    'error_message': error_msg
                })
        except Exception as e:
            self.logger.error(f"Error writing to log file: {e}")
            
    def get_page(self, url: str) -> BeautifulSoup:
        """Fetch and parse a web page"""
        try:
            self.logger.debug(f"Fetching: {url}")
            response = self.session.get(url, timeout=self.timeout)
            response.raise_for_status()
            return BeautifulSoup(response.content, 'html.parser')
        except requests.exceptions.RequestException as e:
            self.logger.error(f"Error fetching {url}: {e}")
            raise
            
    def get_manufacturers(self) -> List[Dict[str, str]]:
        """Get list of manufacturers from the manufacturers page"""
        manufacturers_url = "https://www.datasheets.com/manufacturers"
        self.logger.info("Fetching manufacturers list...")
        
        try:
            soup = self.get_page(manufacturers_url)
            manufacturers = []
            
            # Look for manufacturer links - this may need adjustment based on actual HTML structure
            for link in soup.find_all('a', href=True):
                href = link.get('href', '')
                if href.startswith('/') and len(href.split('/')) == 2 and href != '/manufacturers':
                    manufacturer_name = href.strip('/')
                    
                    # Apply manufacturer filter if specified
                    if self.manufacturer_filter and not manufacturer_name.upper().startswith(self.manufacturer_filter):
                        continue
                    
                    full_url = urljoin("https://www.datasheets.com", href)
                    manufacturers.append({
                        'name': manufacturer_name,
                        'url': full_url
                    })
            
            # Sort manufacturers alphabetically for consistent ordering
            manufacturers.sort(key=lambda x: x['name'].lower())
            
            if self.manufacturer_filter:
                self.logger.info(f"Found {len(manufacturers)} manufacturers starting with '{self.manufacturer_filter}'")
            else:
                self.logger.info(f"Found {len(manufacturers)} manufacturers")
            return manufacturers
            
        except Exception as e:
            self.logger.error(f"Error getting manufacturers: {e}")
            return []
            
    def get_components_from_manufacturer(self, manufacturer_url: str) -> List[str]:
        """Get component URLs from a manufacturer's page"""
        try:
            soup = self.get_page(manufacturer_url)
            components = []
            
            # Look for component links
            for link in soup.find_all('a', href=True):
                href = link.get('href', '')
                # Component URLs typically follow pattern /manufacturer/component
                if href.count('/') >= 2 and not href.endswith('/manufacturers'):
                    full_url = urljoin("https://www.datasheets.com", href)
                    components.append(full_url)
                    
            # Remove duplicates
            components = list(set(components))
            self.logger.debug(f"Found {len(components)} components for {manufacturer_url}")
            return components
            
        except Exception as e:
            self.logger.error(f"Error getting components from {manufacturer_url}: {e}")
            return []
            
    def get_datasheet_download_url(self, component_url: str) -> str:
        """Extract datasheet download URL from component page"""
        try:
            soup = self.get_page(component_url)
            
            # Look for the datasheet button with data-testid="datasheet-button"
            datasheet_button = soup.find(attrs={"data-testid": "datasheet-button"})
            if datasheet_button:
                # Find the <a> element within the button
                link = datasheet_button.find('a', href=True)
                if link:
                    download_url = link.get('href')
                    if download_url:
                        # Convert relative URLs to absolute
                        if download_url.startswith('/'):
                            download_url = urljoin("https://www.datasheets.com", download_url)
                        return download_url
                        
            self.logger.warning(f"No datasheet download button found on {component_url}")
            return ""
            
        except Exception as e:
            self.logger.error(f"Error getting download URL from {component_url}: {e}")
            return ""
            
    def download_datasheet(self, download_url: str, component_url: str) -> bool:
        """Download a datasheet file"""
        try:
            # Generate filename from URL
            parsed_url = urlparse(download_url)
            filename = os.path.basename(parsed_url.path)
            if not filename or not filename.lower().endswith('.pdf'):
                # Generate filename from component URL if needed
                component_name = os.path.basename(urlparse(component_url).path)
                filename = f"{component_name}.pdf"
                
            filepath = self.output_dir / filename
            
            # Skip if already exists
            if filepath.exists():
                self.logger.debug(f"File already exists: {filename}")
                self.log_download(component_url, filename, "skipped", "File already exists")
                return True
                
            # Download the file
            self.logger.info(f"Downloading: {filename}")
            response = self.session.get(download_url, timeout=self.timeout)
            response.raise_for_status()
            
            # Save file
            with open(filepath, 'wb') as f:
                f.write(response.content)
                
            self.log_download(component_url, filename, "success")
            self.logger.info(f"Successfully downloaded: {filename}")
            return True
            
        except Exception as e:
            error_msg = str(e)
            self.logger.error(f"Error downloading {download_url}: {error_msg}")
            self.log_download(component_url, "", "error", error_msg)
            return False
            
    def process_component_batch(self, component_urls: List[str]) -> Dict[str, int]:
        """Process a batch of component URLs"""
        stats = {'success': 0, 'error': 0, 'skipped': 0}
        
        for i, component_url in enumerate(component_urls, 1):
            try:
                # Skip if already downloaded
                if component_url in self.downloaded_urls:
                    stats['skipped'] += 1
                    self.logger.debug(f"Skipping previously downloaded: {component_url}")
                    continue
                    
                self.logger.info(f"Processing component {i}/{len(component_urls)}: {component_url}")
                
                # Get download URL
                download_url = self.get_datasheet_download_url(component_url)
                if not download_url:
                    stats['error'] += 1
                    continue
                    
                # Download datasheet
                if self.download_datasheet(download_url, component_url):
                    stats['success'] += 1
                    self.downloaded_urls.add(component_url)
                else:
                    stats['error'] += 1
                    
                # Rate limiting delay
                if i < len(component_urls):  # Don't delay after last item
                    time.sleep(self.delay)
                    
            except Exception as e:
                self.logger.error(f"Error processing component {component_url}: {e}")
                stats['error'] += 1
                
        return stats
        
    def run_scraper(self):
        """Main scraper execution"""
        self.logger.info("Starting datasheet scraper...")
        
        try:
            # Get manufacturers
            manufacturers = self.get_manufacturers()
            if not manufacturers:
                self.logger.error("No manufacturers found. Exiting.")
                return
                
            total_stats = self.progress['total_stats'].copy()
            resume_found = False
            
            # If we're resuming, find the right starting point
            start_index = 0
            if self.progress.get('last_completed_manufacturer'):
                for i, manufacturer in enumerate(manufacturers):
                    if manufacturer['name'] == self.progress['last_completed_manufacturer']:
                        start_index = i + 1  # Start with next manufacturer
                        resume_found = True
                        self.logger.info(f"Resuming after completed manufacturer: {manufacturer['name']}")
                        break
                        
            elif self.progress.get('current_manufacturer'):
                for i, manufacturer in enumerate(manufacturers):
                    if manufacturer['name'] == self.progress['current_manufacturer']:
                        start_index = i  # Resume from this manufacturer
                        resume_found = True
                        self.logger.info(f"Resuming from manufacturer: {manufacturer['name']}")
                        break
            
            if self.progress.get('last_completed_manufacturer') or self.progress.get('current_manufacturer'):
                if not resume_found:
                    self.logger.warning("Could not find resume point, starting from beginning")
                    start_index = 0
            
            # Process manufacturers starting from resume point
            for i in range(start_index, len(manufacturers)):
                manufacturer = manufacturers[i]
                self.logger.info(f"Processing manufacturer {i+1}/{len(manufacturers)}: {manufacturer['name']}")
                
                try:
                    # Get components for this manufacturer
                    components = self.get_components_from_manufacturer(manufacturer['url'])
                    if not components:
                        self.logger.warning(f"No components found for {manufacturer['name']}")
                        # Mark as completed even if no components
                        self.save_progress(completed_manufacturer=manufacturer['name'])
                        continue
                        
                    self.logger.info(f"Found {len(components)} components for {manufacturer['name']}")
                    
                    # Update progress to current manufacturer
                    self.save_progress(manufacturer_name=manufacturer['name'])
                    
                    # Determine starting batch if resuming within this manufacturer
                    start_batch = 0
                    if (self.progress.get('current_manufacturer') == manufacturer['name'] and 
                        self.progress.get('last_completed_batch') is not None):
                        start_batch = self.progress['last_completed_batch'] + 1
                        self.logger.info(f"Resuming from batch {start_batch + 1}")
                    
                    # Process components in batches
                    total_batches = (len(components) + self.batch_size - 1) // self.batch_size
                    for batch_num in range(start_batch, total_batches):
                        batch_start = batch_num * self.batch_size
                        batch_end = min(batch_start + self.batch_size, len(components))
                        batch = components[batch_start:batch_end]
                        
                        self.logger.info(f"Processing batch {batch_num + 1}/{total_batches} "
                                       f"({batch_start + 1}-{batch_end} of {len(components)})")
                        
                        batch_stats = self.process_component_batch(batch)
                        
                        # Update total stats
                        for key in total_stats:
                            total_stats[key] += batch_stats[key]
                            
                        # Save progress after each batch
                        self.save_progress(manufacturer['name'], batch_num, stats=batch_stats)
                        
                        self.logger.info(f"Batch {batch_num + 1} complete: {batch_stats}")
                        
                        # Brief pause between batches
                        if batch_num < total_batches - 1:
                            time.sleep(self.delay * 2)
                    
                    # Mark manufacturer as completed
                    self.save_progress(completed_manufacturer=manufacturer['name'])
                    self.logger.info(f"Completed manufacturer: {manufacturer['name']}")
                            
                except Exception as e:
                    self.logger.error(f"Error processing manufacturer {manufacturer['name']}: {e}")
                    # Save progress even on error so we can resume
                    self.save_progress(manufacturer_name=manufacturer['name'])
                    continue
                    
            # Final summary
            self.logger.info("Scraping complete!")
            self.logger.info(f"Final stats: {total_stats}")
            
            # Clear progress file on successful completion
            if self.progress_file.exists():
                self.progress_file.unlink()
                self.logger.info("Cleared progress file (scraping completed)")
            
        except KeyboardInterrupt:
            self.logger.info("Scraping interrupted by user")
            self.logger.info("Progress has been saved. Use the same command to resume.")
        except Exception as e:
            self.logger.error(f"Fatal error: {e}")
            self.logger.info("Progress has been saved. Use the same command to resume.")
            
def main():
    parser = argparse.ArgumentParser(
        description="Scrape datasheets from datasheets.com",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python datasheet_scraper.py -o ./datasheets
  python datasheet_scraper.py -o /path/to/datasheets --batch-size 25 --delay 2.0
  python datasheet_scraper.py -o ./output --timeout 60 --verbose
  python datasheet_scraper.py -o ./datasheets --manufacturer-filter R
  python datasheet_scraper.py -o ./datasheets --manufacturer-filter "A" --verbose
        """
    )
    
    parser.add_argument(
        '-o', '--output-dir',
        required=True,
        help='Output directory for downloaded datasheets'
    )
    
    parser.add_argument(
        '-m', '--manufacturer-filter',
        help='Filter manufacturers by first letter (e.g., "R" for Renesas, Rohm, etc.)'
    )
    
    parser.add_argument(
        '--batch-size',
        type=int,
        default=DEFAULT_BATCH_SIZE,
        help=f'Number of URLs to process per batch (default: {DEFAULT_BATCH_SIZE})'
    )
    
    parser.add_argument(
        '--delay',
        type=float,
        default=DEFAULT_DELAY,
        help=f'Delay in seconds between requests (default: {DEFAULT_DELAY})'
    )
    
    parser.add_argument(
        '--timeout',
        type=int,
        default=DEFAULT_TIMEOUT,
        help=f'Request timeout in seconds (default: {DEFAULT_TIMEOUT})'
    )
    
    parser.add_argument(
        '--verbose',
        action='store_true',
        help='Enable verbose logging'
    )
    
    parser.add_argument(
        '--reset-progress',
        action='store_true',
        help='Reset progress and start from beginning'
    )
    
    parser.add_argument(
        '--version',
        action='version',
        version=f'Datasheet Scraper v{SCRIPT_VERSION}'
    )
    
    args = parser.parse_args()
    
    # Validate arguments
    if args.batch_size <= 0:
        print("Error: batch-size must be positive", file=sys.stderr)
        return 1
        
    if args.delay < 0:
        print("Error: delay cannot be negative", file=sys.stderr)
        return 1
        
    if args.manufacturer_filter and len(args.manufacturer_filter) != 1:
        print("Error: manufacturer-filter must be a single letter", file=sys.stderr)
        return 1
        
    try:
        # Reset progress if requested
        if args.reset_progress:
            progress_file = Path(args.output_dir) / "scraper_progress.json"
            if progress_file.exists():
                progress_file.unlink()
                print("Progress reset successfully")
        
        # Create scraper instance
        scraper = DatasheetScraper(
            output_dir=args.output_dir,
            batch_size=args.batch_size,
            delay=args.delay,
            timeout=args.timeout,
            manufacturer_filter=args.manufacturer_filter
        )
        
        # Set verbose logging if requested
        if args.verbose:
            scraper.logger.setLevel(logging.DEBUG)
            
        # Run the scraper
        scraper.run_scraper()
        return 0
        
    except Exception as e:
        print(f"Fatal error: {e}", file=sys.stderr)
        return 1

if __name__ == "__main__":
    sys.exit(main())