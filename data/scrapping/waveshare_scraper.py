#!/usr/bin/env python3
"""
Waveshare Datasheet Scraper
Version: 1.0.0

This script scrapes datasheets from waveshare.com by:
1. Discovering datasheet categories on the wiki
2. Extracting PDF links from category pages and product pages
3. Downloading datasheets from files.waveshare.com and other sources
4. Organizing downloads by category
5. Logging all activities and preventing re-downloads

# Download all datasheets
python waveshare_scraper.py -o ./waveshare_datasheets

# Download only LCD-related datasheets
python waveshare_scraper.py -o ./datasheets --category LCD

# Download STM32-related datasheets with verbose logging
python waveshare_scraper.py -o ./datasheets --category STM32 --verbose

# Custom batch size and delay (be respectful to their servers)
python waveshare_scraper.py -o ./datasheets --batch-size 10 --delay 2.0

# Reset progress and start over
python waveshare_scraper.py -o ./datasheets --reset-progress
"""

import argparse
import csv
import json
import logging
import os
import re
import requests
import sys
import time
from datetime import datetime
from pathlib import Path
from urllib.parse import urljoin, urlparse, unquote
from typing import List, Dict, Set, Optional

import bs4
from bs4 import BeautifulSoup

#
# Script version
SCRIPT_VERSION = "1.0.0"

# Default settings
DEFAULT_BATCH_SIZE = 20
DEFAULT_DELAY = 1.5  # seconds between requests (be respectful to Waveshare)
DEFAULT_TIMEOUT = 30  # seconds
USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

# Known datasheet categories and starting points
DATASHEET_CATEGORIES = [
    "LCD_Datasheets",
    "Altera_Datasheets", 
    "XILINX_Datasheets",
    "STM32_Datasheets",
    "Microchip_Datasheets",
    "FT232_Datasheets",
    "10_DOF_IMU_Sensor_Datasheets",
    "LAN8720-ETH-Board_Datasheets",
    "7inch-Capacitive-Touch-LCD-C_Datasheets",
    "7inch-Capacitive-Touch-LCD-D_Datasheets"
]

class WaveshareScraper:
    def __init__(self, output_dir: str, batch_size: int = DEFAULT_BATCH_SIZE, 
                 delay: float = DEFAULT_DELAY, timeout: int = DEFAULT_TIMEOUT,
                 category_filter: Optional[str] = None):
        self.output_dir = Path(output_dir)
        self.batch_size = batch_size
        self.delay = delay
        self.timeout = timeout
        self.category_filter = category_filter
        self.session = requests.Session()
        self.session.headers.update({'User-Agent': USER_AGENT})
        
        # Create output directory
        self.output_dir.mkdir(parents=True, exist_ok=True)
        
        # Setup logging
        self.setup_logging()
        
        # Initialize tracking files
        self.log_file = self.output_dir / "download_log.csv"
        self.progress_file = self.output_dir / "scraper_progress.json"
        self.downloaded_urls = self.load_downloaded_urls()
        self.progress = self.load_progress()
        
        self.logger.info(f"Waveshare Datasheet Scraper v{SCRIPT_VERSION} initialized")
        self.logger.info(f"Output directory: {self.output_dir}")
        self.logger.info(f"Batch size: {batch_size}")
        if self.category_filter:
            self.logger.info(f"Category filter: {self.category_filter}")
    
    def setup_logging(self):
        """Setup logging configuration"""
        log_file = self.output_dir / "scraper.log"
        
        file_formatter = logging.Formatter(
            '%(asctime)s - %(levelname)s - %(message)s'
        )
        console_formatter = logging.Formatter(
            '%(levelname)s: %(message)s'
        )
        
        self.logger = logging.getLogger('waveshare_scraper')
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
            'completed_categories': [],
            'current_category': None,
            'total_stats': {'success': 0, 'error': 0, 'skipped': 0},
            'discovered_categories': [],
            'last_updated': None
        }
        
        if self.progress_file.exists():
            try:
                with open(self.progress_file, 'r', encoding='utf-8') as f:
                    progress = json.load(f)
                    for key in default_progress:
                        if key not in progress:
                            progress[key] = default_progress[key]
                    self.logger.info(f"Loaded progress: {len(progress.get('completed_categories', []))} categories completed")
                    return progress
            except Exception as e:
                self.logger.warning(f"Could not load progress file: {e}")
        
        return default_progress
    
    def save_progress(self, category: str = None, completed_category: str = None, 
                     stats: Dict = None, discovered_categories: List[str] = None):
        """Save current scraping progress"""
        try:
            if stats:
                for key in stats:
                    self.progress['total_stats'][key] += stats[key]
            
            if completed_category:
                if completed_category not in self.progress['completed_categories']:
                    self.progress['completed_categories'].append(completed_category)
                self.progress['current_category'] = None
            elif category:
                self.progress['current_category'] = category
            
            if discovered_categories:
                self.progress['discovered_categories'] = discovered_categories
            
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
    
    def log_download(self, url: str, filename: str, status: str, category: str = "", error_msg: str = ""):
        """Log download attempt to CSV file"""
        file_exists = self.log_file.exists()
        try:
            with open(self.log_file, 'a', newline='', encoding='utf-8') as f:
                fieldnames = ['timestamp', 'filename', 'url', 'category', 'status', 'script_version', 'error_message']
                writer = csv.DictWriter(f, fieldnames=fieldnames)
                
                if not file_exists:
                    writer.writeheader()
                
                writer.writerow({
                    'timestamp': datetime.now().isoformat(),
                    'filename': filename,
                    'url': url,
                    'category': category,
                    'status': status,
                    'script_version': SCRIPT_VERSION,
                    'error_message': error_msg
                })
        except Exception as e:
            self.logger.error(f"Error writing to log file: {e}")
    
    def get_page(self, url: str) -> BeautifulSoup:
        """Fetch and parse a web page with error handling"""
        try:
            self.logger.debug(f"Fetching: {url}")
            response = self.session.get(url, timeout=self.timeout)
            response.raise_for_status()
            return BeautifulSoup(response.content, 'html.parser')
        except requests.exceptions.RequestException as e:
            self.logger.error(f"Error fetching {url}: {e}")
            raise
    
    def discover_datasheet_categories(self) -> List[str]:
        """Discover all datasheet-related categories on Waveshare wiki"""
        discovered = set(DATASHEET_CATEGORIES)  # Start with known categories
        
        # Try to find more categories by searching for "Datasheets" pages
        search_patterns = [
            "https://www.waveshare.com/wiki/Special:Search",
            "https://www.waveshare.com/wiki/Category:Datasheets"
        ]
        
        # Look for datasheet links in common pages
        common_pages = [
            "https://www.waveshare.com/wiki/Main_Page",
        ]
        
        # Since direct access might be limited, we'll use our known categories
        # and try to discover more through links within those pages
        
        for category in list(discovered):
            try:
                url = f"https://www.waveshare.com/wiki/{category}"
                soup = self.get_page(url)
                
                # Look for links to other datasheet pages
                for link in soup.find_all('a', href=True):
                    href = link.get('href', '')
                    if 'Datasheets' in href or 'datasheet' in href.lower():
                        # Extract page name
                        if href.startswith('/wiki/'):
                            page_name = href.replace('/wiki/', '')
                            if page_name not in discovered:
                                discovered.add(page_name)
                
                time.sleep(self.delay)
            except Exception as e:
                self.logger.warning(f"Could not explore category {category}: {e}")
                continue
        
        categories = list(discovered)
        self.logger.info(f"Discovered {len(categories)} datasheet categories")
        return categories
    
    def extract_pdf_links_from_page(self, url: str, category: str) -> List[Dict[str, str]]:
        """Extract PDF links from a wiki page"""
        pdf_links = []
        try:
            soup = self.get_page(url)
            
            # Look for direct PDF links
            for link in soup.find_all('a', href=True):
                href = link.get('href', '')
                
                # Check if it's a PDF link
                if (href.endswith('.pdf') or 
                    'File:' in href and '.pdf' in href or
                    'files.waveshare.com' in href and '.pdf' in href):
                    
                    # Convert relative URLs to absolute
                    if href.startswith('/'):
                        pdf_url = urljoin("https://www.waveshare.com", href)
                    elif href.startswith('http'):
                        pdf_url = href
                    else:
                        pdf_url = urljoin(url, href)
                    
                    # Extract filename from URL or link text
                    filename = os.path.basename(urlparse(pdf_url).path)
                    if not filename.endswith('.pdf'):
                        # Try to get filename from link text
                        link_text = link.get_text(strip=True)
                        if link_text and '.pdf' in link_text.lower():
                            filename = link_text
                        else:
                            filename = f"datasheet_{len(pdf_links)}.pdf"
                    
                    pdf_links.append({
                        'url': pdf_url,
                        'filename': filename,
                        'category': category
                    })
            
            # Look for File: pages that might contain PDFs
            for link in soup.find_all('a', href=True):
                href = link.get('href', '')
                if '/wiki/File:' in href and '.pdf' in href:
                    try:
                        file_page_url = urljoin("https://www.waveshare.com", href)
                        file_soup = self.get_page(file_page_url)
                        
                        # Find the actual file download link
                        for file_link in file_soup.find_all('a', href=True):
                            file_href = file_link.get('href', '')
                            if file_href.endswith('.pdf') or 'files.waveshare.com' in file_href:
                                if file_href.startswith('/'):
                                    file_href = urljoin("https://www.waveshare.com", file_href)
                                
                                filename = os.path.basename(urlparse(file_href).path)
                                if not filename:
                                    filename = href.split('File:')[-1]
                                
                                pdf_links.append({
                                    'url': file_href,
                                    'filename': filename,
                                    'category': category
                                })
                                break
                        
                        time.sleep(self.delay * 0.5)  # Small delay for file page requests
                    except Exception as e:
                        self.logger.debug(f"Error processing file page {href}: {e}")
            
        except Exception as e:
            self.logger.error(f"Error extracting PDFs from {url}: {e}")
        
        # Remove duplicates based on URL
        unique_links = []
        seen_urls = set()
        for link in pdf_links:
            if link['url'] not in seen_urls:
                seen_urls.add(link['url'])
                unique_links.append(link)
        
        self.logger.info(f"Found {len(unique_links)} PDF links in {category}")
        return unique_links
    
    def download_pdf(self, pdf_info: Dict[str, str]) -> bool:
        """Download a PDF datasheet"""
        try:
            url = pdf_info['url']
            filename = pdf_info['filename']
            category = pdf_info['category']
            
            # Create category subdirectory
            category_dir = self.output_dir / self.sanitize_filename(category)
            category_dir.mkdir(exist_ok=True)
            
            # Sanitize filename
            safe_filename = self.sanitize_filename(filename)
            if not safe_filename.endswith('.pdf'):
                safe_filename += '.pdf'
            
            filepath = category_dir / safe_filename
            
            # Skip if already exists
            if filepath.exists():
                self.logger.debug(f"File already exists: {safe_filename}")
                self.log_download(url, safe_filename, "skipped", category, "File already exists")
                return True
            
            # Download the file
            self.logger.info(f"Downloading: {category}/{safe_filename}")
            
            response = self.session.get(url, timeout=self.timeout)
            response.raise_for_status()
            
            # Check if response is actually a PDF
            content_type = response.headers.get('content-type', '').lower()
            if 'pdf' not in content_type and len(response.content) < 1000:
                # Might be an HTML error page
                if b'<html' in response.content[:100].lower():
                    raise Exception("Received HTML instead of PDF")
            
            # Save file
            with open(filepath, 'wb') as f:
                f.write(response.content)
            
            self.log_download(url, safe_filename, "success", category)
            self.logger.info(f"Successfully downloaded: {category}/{safe_filename}")
            return True
            
        except Exception as e:
            error_msg = str(e)
            self.logger.error(f"Error downloading {pdf_info['url']}: {error_msg}")
            self.log_download(pdf_info['url'], pdf_info.get('filename', ''), "error", 
                            pdf_info.get('category', ''), error_msg)
            return False
    
    def sanitize_filename(self, filename: str) -> str:
        """Sanitize filename for safe file system storage"""
        # Remove or replace problematic characters
        filename = re.sub(r'[<>:"/\\|?*]', '_', filename)
        filename = re.sub(r'\s+', '_', filename)  # Replace spaces with underscores
        filename = filename.strip('._')  # Remove leading/trailing dots and underscores
        
        # Limit length
        if len(filename) > 200:
            name, ext = os.path.splitext(filename)
            filename = name[:200-len(ext)] + ext
        
        return filename
    
    def process_category(self, category: str) -> Dict[str, int]:
        """Process a single datasheet category"""
        stats = {'success': 0, 'error': 0, 'skipped': 0}
        
        if category in self.progress.get('completed_categories', []):
            self.logger.info(f"Category {category} already completed, skipping")
            return stats
        
        try:
            # Build category URL
            category_url = f"https://www.waveshare.com/wiki/{category}"
            
            self.logger.info(f"Processing category: {category}")
            
            # Extract PDF links from the category page
            pdf_links = self.extract_pdf_links_from_page(category_url, category)
            
            if not pdf_links:
                self.logger.warning(f"No PDF links found in category: {category}")
                self.save_progress(completed_category=category)
                return stats
            
            self.logger.info(f"Found {len(pdf_links)} PDFs in {category}")
            
            # Download PDFs in batches
            for i in range(0, len(pdf_links), self.batch_size):
                batch = pdf_links[i:i + self.batch_size]
                batch_num = i // self.batch_size + 1
                total_batches = (len(pdf_links) + self.batch_size - 1) // self.batch_size
                
                self.logger.info(f"Processing batch {batch_num}/{total_batches} for {category}")
                
                for pdf_info in batch:
                    # Skip if already downloaded
                    if pdf_info['url'] in self.downloaded_urls:
                        stats['skipped'] += 1
                        continue
                    
                    if self.download_pdf(pdf_info):
                        stats['success'] += 1
                        self.downloaded_urls.add(pdf_info['url'])
                    else:
                        stats['error'] += 1
                    
                    time.sleep(self.delay * 0.5)  # Brief delay between downloads
                
                # Save progress after each batch
                self.save_progress(category=category, stats={'success': 0, 'error': 0, 'skipped': 0})
                
                # Delay between batches
                if i + self.batch_size < len(pdf_links):
                    time.sleep(self.delay * 2)
            
            # Mark category as completed
            self.save_progress(completed_category=category, stats=stats)
            
        except Exception as e:
            self.logger.error(f"Error processing category {category}: {e}")
            stats['error'] += 1
        
        return stats
    
    def run_scraper(self):
        """Main scraper execution"""
        self.logger.info("Starting Waveshare datasheet scraper...")
        
        try:
            # Discover datasheet categories
            self.logger.info("Discovering datasheet categories...")
            categories = self.discover_datasheet_categories()
            
            # Apply category filter if specified
            if self.category_filter:
                categories = [cat for cat in categories if self.category_filter.lower() in cat.lower()]
                self.logger.info(f"Filtered to {len(categories)} categories matching '{self.category_filter}'")
            
            if not categories:
                self.logger.error("No datasheet categories found. Exiting.")
                return
            
            # Save discovered categories
            self.save_progress(discovered_categories=categories)
            
            total_stats = self.progress['total_stats'].copy()
            
            # Process each category
            for i, category in enumerate(categories, 1):
                if category in self.progress.get('completed_categories', []):
                    self.logger.info(f"Skipping completed category {i}/{len(categories)}: {category}")
                    continue
                
                self.logger.info(f"Processing category {i}/{len(categories)}: {category}")
                
                try:
                    category_stats = self.process_category(category)
                    
                    # Update total stats
                    for key in total_stats:
                        total_stats[key] += category_stats[key]
                    
                    self.logger.info(f"Category {category} complete: {category_stats}")
                    
                    # Delay between categories
                    if i < len(categories):
                        time.sleep(self.delay * 3)
                        
                except Exception as e:
                    self.logger.error(f"Error with category {category}: {e}")
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
        description="Scrape datasheets from waveshare.com",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python waveshare_scraper.py -o ./waveshare_datasheets
  python waveshare_scraper.py -o ./datasheets --category LCD --verbose
  python waveshare_scraper.py -o ./output --batch-size 10 --delay 2.0
  python waveshare_scraper.py -o ./datasheets --reset-progress
        """
    )
    
    parser.add_argument(
        '-o', '--output-dir',
        required=True,
        help='Output directory for downloaded datasheets'
    )
    
    parser.add_argument(
        '-c', '--category',
        help='Filter categories by name (partial match, e.g., "LCD", "STM32")'
    )
    
    parser.add_argument(
        '--batch-size',
        type=int,
        default=DEFAULT_BATCH_SIZE,
        help=f'Number of PDFs to download per batch (default: {DEFAULT_BATCH_SIZE})'
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
        version=f'Waveshare Datasheet Scraper v{SCRIPT_VERSION}'
    )
    
    args = parser.parse_args()
    
    # Validate arguments
    if args.batch_size <= 0:
        print("Error: batch-size must be positive", file=sys.stderr)
        return 1
        
    if args.delay < 0:
        print("Error: delay cannot be negative", file=sys.stderr)
        return 1
        
    try:
        # Reset progress if requested
        if args.reset_progress:
            progress_file = Path(args.output_dir) / "scraper_progress.json"
            if progress_file.exists():
                progress_file.unlink()
                print("Progress reset successfully")
        
        # Create scraper instance
        scraper = WaveshareScraper(
            output_dir=args.output_dir,
            batch_size=args.batch_size,
            delay=args.delay,
            timeout=args.timeout,
            category_filter=args.category
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