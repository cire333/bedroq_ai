#!/usr/bin/env python3
"""
FTC Electronics Datasheet Scraper
Version: 1.0.0

This script scrapes datasheets from ftcelectronics.com by following the exact navigation:
1. Start at manufacturers page with A-Z filter
2. Visit each letter page (e.g., /manufacturers/A)
3. Extract manufacturer links from each letter page
4. Visit each manufacturer page to find component categories
5. Visit component category pages to find individual products
6. Download datasheets from product pages
7. Process all pages until complete

python future_scraper.py -o ./datasheets --start-letter A --end-letter A
python future_scraper.py -o ./datasheets --start-letter B --end-letter B
python future_scraper.py -o ./datasheets --start-letter C --end-letter C
python future_scraper.py -o ./datasheets --start-letter D --end-letter D
python future_scraper.py -o ./datasheets --start-letter E --end-letter E
python future_scraper.py -o ./datasheets --start-letter F --end-letter F
python future_scraper.py -o ./datasheets --start-letter G --end-letter G
python future_scraper.py -o ./datasheets --start-letter H --end-letter H
python future_scraper.py -o ./datasheets --start-letter I --end-letter I
python future_scraper.py -o ./datasheets --start-letter J --end-letter J
python future_scraper.py -o ./datasheets --start-letter K --end-letter K
python future_scraper.py -o ./datasheets --start-letter L --end-letter L
python future_scraper.py -o ./datasheets --start-letter M --end-letter M
python future_scraper.py -o ./datasheets --start-letter N --end-letter N
python future_scraper.py -o ./datasheets --start-letter O --end-letter O
python future_scraper.py -o ./datasheets --start-letter P --end-letter P
python future_scraper.py -o ./datasheets --start-letter Q --end-letter Q
python future_scraper.py -o ./datasheets --start-letter R --end-letter R
python future_scraper.py -o ./datasheets --start-letter S --end-letter S
python future_scraper.py -o ./datasheets --start-letter T --end-letter T
python future_scraper.py -o ./datasheets --start-letter U --end-letter U
python future_scraper.py -o ./datasheets --start-letter V --end-letter V
python future_scraper.py -o ./datasheets --start-letter W --end-letter W

python future_scraper.py -o ./datasheets --start-letter X --end-letter X
python future_scraper.py -o ./datasheets --start-letter Y --end-letter Y
python future_scraper.py -o ./datasheets --start-letter Z --end-letter Z

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
from typing import List, Dict, Set, Optional, Tuple

import bs4
from bs4 import BeautifulSoup

# Script version
SCRIPT_VERSION = "1.0.0"

# Default settings
DEFAULT_BATCH_SIZE = 20
DEFAULT_DELAY = 1.5  # seconds between requests
DEFAULT_TIMEOUT = 30
USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

# Alphabet for letter-based navigation
ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"

class FTCElectronicsScraper:
    def __init__(self, output_dir: str, batch_size: int = DEFAULT_BATCH_SIZE, 
                 delay: float = DEFAULT_DELAY, timeout: int = DEFAULT_TIMEOUT,
                 start_letter: Optional[str] = None, end_letter: Optional[str] = None):
        self.output_dir = Path(output_dir)
        self.batch_size = batch_size
        self.delay = delay
        self.timeout = timeout
        self.start_letter = start_letter.upper() if start_letter else None
        self.end_letter = end_letter.upper() if end_letter else None
        self.session = requests.Session()
        self.session.headers.update({'User-Agent': USER_AGENT})
        
        # Create output directory
        self.output_dir.mkdir(parents=True, exist_ok=True)
        
        # Setup logging
        self.setup_logging()
        
        # Initialize tracking
        self.log_file = self.output_dir / "download_log.csv"
        self.progress_file = self.output_dir / "scraper_progress.json"
        self.downloaded_urls = self.load_downloaded_urls()
        self.progress = self.load_progress()
        
        self.logger.info(f"FTC Electronics Datasheet Scraper v{SCRIPT_VERSION} initialized")
        self.logger.info(f"Output directory: {self.output_dir}")
        self.logger.info(f"Batch size: {batch_size}")
        
        if self.start_letter or self.end_letter:
            range_str = f"{self.start_letter or 'A'}-{self.end_letter or 'Z'}"
            self.logger.info(f"Letter range: {range_str}")

    def setup_logging(self):
        """Setup logging configuration"""
        log_file = self.output_dir / "scraper.log"
        
        file_formatter = logging.Formatter(
            '%(asctime)s - %(levelname)s - %(message)s'
        )
        console_formatter = logging.Formatter(
            '%(levelname)s: %(message)s'
        )
        
        self.logger = logging.getLogger('ftc_scraper')
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
        """Load scraping progress"""
        default_progress = {
            'completed_letters': [],
            'current_letter': None,
            'completed_manufacturers': [],
            'current_manufacturer': None,
            'completed_categories': [],
            'current_category': None,
            'total_stats': {'success': 0, 'error': 0, 'skipped': 0},
            'last_updated': None
        }
        
        if self.progress_file.exists():
            try:
                with open(self.progress_file, 'r', encoding='utf-8') as f:
                    progress = json.load(f)
                    for key in default_progress:
                        if key not in progress:
                            progress[key] = default_progress[key]
                    self.logger.info(f"Loaded progress from previous run")
                    return progress
            except Exception as e:
                self.logger.warning(f"Could not load progress file: {e}")
        
        return default_progress
    
    def save_progress(self, **kwargs):
        """Save current progress"""
        try:
            if 'stats' in kwargs:
                for key in kwargs['stats']:
                    self.progress['total_stats'][key] += kwargs['stats'][key]
            
            for key, value in kwargs.items():
                if key != 'stats' and key in self.progress:
                    self.progress[key] = value
            
            self.progress['last_updated'] = datetime.now().isoformat()
            
            with open(self.progress_file, 'w', encoding='utf-8') as f:
                json.dump(self.progress, f, indent=2)
                
        except Exception as e:
            self.logger.error(f"Error saving progress: {e}")

    def load_downloaded_urls(self) -> Set[str]:
        """Load previously downloaded URLs"""
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
    
    def log_download(self, url: str, filename: str, status: str, 
                    manufacturer: str = "", category: str = "", part_number: str = "",
                    error_msg: str = ""):
        """Log download attempt"""
        file_exists = self.log_file.exists()
        try:
            with open(self.log_file, 'a', newline='', encoding='utf-8') as f:
                fieldnames = ['timestamp', 'filename', 'url', 'manufacturer', 
                             'category', 'part_number', 'status', 'script_version', 'error_message']
                writer = csv.DictWriter(f, fieldnames=fieldnames)
                
                if not file_exists:
                    writer.writeheader()
                
                writer.writerow({
                    'timestamp': datetime.now().isoformat(),
                    'filename': filename,
                    'url': url,
                    'manufacturer': manufacturer,
                    'category': category,
                    'part_number': part_number,
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

    def get_manufacturers_by_letter(self, letter: str) -> List[Dict[str, str]]:
        """Get manufacturers for a specific letter"""
        url = f"https://www.ftcelectronics.com/manufacturers/{letter}"
        self.logger.info(f"Fetching manufacturers for letter {letter}")
        
        try:
            soup = self.get_page(url)
            manufacturers = []
            
            # Look for manufacturer links
            # These typically appear as links within the page content
            for link in soup.find_all('a', href=True):
                href = link.get('href', '').strip()
                link_text = link.get_text(strip=True)
                
                # Look for manufacturer page links
                # Pattern: /manufacturers/Manufacturer-Name
                if (href.startswith('/manufacturers/') and 
                    href.count('/') == 2 and 
                    len(href.split('/')[-1]) > 1 and
                    href.split('/')[-1] != letter):
                    
                    manufacturer_slug = href.split('/')[-1]
                    manufacturer_name = manufacturer_slug.replace('-', ' ')
                    
                    full_url = urljoin("https://www.ftcelectronics.com", href)
                    manufacturers.append({
                        'name': manufacturer_name,
                        'slug': manufacturer_slug,
                        'url': full_url,
                        'letter': letter
                    })
            
            # Remove duplicates
            unique_manufacturers = []
            seen_slugs = set()
            for mfg in manufacturers:
                if mfg['slug'] not in seen_slugs:
                    seen_slugs.add(mfg['slug'])
                    unique_manufacturers.append(mfg)
            
            self.logger.info(f"Found {len(unique_manufacturers)} manufacturers for letter {letter}")
            return unique_manufacturers
            
        except Exception as e:
            self.logger.error(f"Error getting manufacturers for letter {letter}: {e}")
            return []

    def get_component_categories(self, manufacturer_url: str, manufacturer_name: str) -> List[Dict[str, str]]:
        """Get component categories for a manufacturer"""
        try:
            soup = self.get_page(manufacturer_url)
            categories = []
            
            # Look for category links
            # These might be in various formats, look for links that go to /products/
            for link in soup.find_all('a', href=True):
                href = link.get('href', '').strip()
                link_text = link.get_text(strip=True)
                
                # Look for product category links
                if ('/products/' in href and 
                    len(link_text) > 3 and
                    not href.endswith('.pdf')):
                    
                    full_url = urljoin("https://www.ftcelectronics.com", href)
                    
                    # Extract category name from URL or link text
                    category_name = link_text
                    if not category_name or len(category_name) < 3:
                        # Try to extract from URL
                        parts = href.split('/')
                        if len(parts) >= 3:
                            category_name = parts[-1].replace('-', ' ').replace(',', ' ')
                    
                    categories.append({
                        'name': category_name,
                        'url': full_url,
                        'manufacturer': manufacturer_name
                    })
            
            # Alternative: look for any links that might lead to product listings
            if not categories:
                # Look for links with product-related keywords
                product_keywords = ['components', 'products', 'parts', 'ics', 'semiconductors']
                for link in soup.find_all('a', href=True):
                    href = link.get('href', '').strip()
                    link_text = link.get_text(strip=True).lower()
                    
                    if (any(keyword in link_text for keyword in product_keywords) or
                        any(keyword in href.lower() for keyword in product_keywords)):
                        
                        full_url = urljoin("https://www.ftcelectronics.com", href)
                        categories.append({
                            'name': link.get_text(strip=True),
                            'url': full_url,
                            'manufacturer': manufacturer_name
                        })
            
            # Remove duplicates
            unique_categories = []
            seen_urls = set()
            for cat in categories:
                if cat['url'] not in seen_urls:
                    seen_urls.add(cat['url'])
                    unique_categories.append(cat)
            
            self.logger.info(f"Found {len(unique_categories)} categories for {manufacturer_name}")
            return unique_categories
            
        except Exception as e:
            self.logger.error(f"Error getting categories for {manufacturer_name}: {e}")
            return []

    def get_products_from_category(self, category_url: str, category_name: str, manufacturer_name: str) -> List[Dict[str, str]]:
        """Get products from a category page"""
        try:
            products = []
            page = 1
            max_pages = 50  # Safety limit
            
            while page <= max_pages:
                # Build paginated URL
                if page == 1:
                    url = category_url
                else:
                    separator = '&' if '?' in category_url else '?'
                    url = f"{category_url}{separator}page={page}"
                
                try:
                    soup = self.get_page(url)
                    page_products = []
                    
                    # Look for product links
                    # Products might be linked in various ways
                    for link in soup.find_all('a', href=True):
                        href = link.get('href', '').strip()
                        link_text = link.get_text(strip=True)
                        
                        # Look for product detail pages or part numbers
                        if (len(link_text) > 3 and 
                            not href.endswith('.pdf') and
                            (re.match(r'^[A-Z0-9\-_]+$', link_text) or  # Looks like part number
                             '/product/' in href or 
                             'part' in href.lower())):
                            
                            full_url = urljoin("https://www.ftcelectronics.com", href)
                            
                            # Extract part number
                            part_number = link_text if re.match(r'^[A-Z0-9\-_]+$', link_text) else ""
                            if not part_number:
                                # Try to extract from URL
                                url_parts = href.split('/')
                                if url_parts:
                                    part_number = url_parts[-1]
                            
                            page_products.append({
                                'part_number': part_number,
                                'url': full_url,
                                'category': category_name,
                                'manufacturer': manufacturer_name
                            })
                    
                    if not page_products:
                        break
                    
                    products.extend(page_products)
                    self.logger.debug(f"Found {len(page_products)} products on page {page} of {category_name}")
                    
                    # Check for next page
                    next_links = soup.find_all('a', string=re.compile(r'Next|>'))
                    has_next = any(link.get('href') for link in next_links)
                    
                    if not has_next:
                        break
                    
                    page += 1
                    time.sleep(self.delay * 0.5)
                    
                except Exception as e:
                    self.logger.debug(f"Error on page {page} of {category_name}: {e}")
                    break
            
            # Remove duplicates
            unique_products = []
            seen_urls = set()
            for product in products:
                if product['url'] not in seen_urls:
                    seen_urls.add(product['url'])
                    unique_products.append(product)
            
            self.logger.info(f"Found {len(unique_products)} products in {category_name}")
            return unique_products
            
        except Exception as e:
            self.logger.error(f"Error getting products from {category_url}: {e}")
            return []

    def get_datasheet_urls_from_product(self, product_url: str, product_info: Dict[str, str]) -> List[Dict[str, str]]:
        """Extract datasheet URLs from a product page"""
        try:
            soup = self.get_page(product_url)
            datasheets = []
            
            # Look for datasheet links
            # Search for links containing "datasheet" or ending with .pdf
            for link in soup.find_all('a', href=True):
                href = link.get('href', '').strip()
                link_text = link.get_text(strip=True).lower()
                
                # Check if this looks like a datasheet link
                if (href.endswith('.pdf') or 
                    'datasheet' in link_text or 
                    'data sheet' in link_text or
                    'specification' in link_text):
                    
                    # Convert relative URLs to absolute
                    if href.startswith('/'):
                        pdf_url = urljoin("https://www.ftcelectronics.com", href)
                    elif href.startswith('http'):
                        pdf_url = href
                    else:
                        pdf_url = urljoin(product_url, href)
                    
                    # Generate filename
                    filename = os.path.basename(urlparse(pdf_url).path)
                    if not filename or not filename.endswith('.pdf'):
                        part_number = product_info.get('part_number', 'datasheet')
                        filename = f"{part_number}_datasheet.pdf"
                    
                    datasheets.append({
                        'url': pdf_url,
                        'filename': filename,
                        'part_number': product_info.get('part_number', ''),
                        'manufacturer': product_info.get('manufacturer', ''),
                        'category': product_info.get('category', ''),
                        'source_page': product_url
                    })
            
            # Alternative: look in specific sections or divs that might contain datasheets
            datasheet_sections = soup.find_all(['div', 'section'], 
                                              string=re.compile(r'datasheet|specification', re.I))
            
            for section in datasheet_sections:
                parent = section.parent if section.parent else section
                for link in parent.find_all('a', href=True):
                    href = link.get('href', '').strip()
                    if href.endswith('.pdf'):
                        pdf_url = urljoin("https://www.ftcelectronics.com", href)
                        filename = os.path.basename(urlparse(pdf_url).path)
                        
                        if not any(ds['url'] == pdf_url for ds in datasheets):
                            datasheets.append({
                                'url': pdf_url,
                                'filename': filename,
                                'part_number': product_info.get('part_number', ''),
                                'manufacturer': product_info.get('manufacturer', ''),
                                'category': product_info.get('category', ''),
                                'source_page': product_url
                            })
            
            return datasheets
            
        except Exception as e:
            self.logger.debug(f"Error getting datasheets from {product_url}: {e}")
            return []

    def download_datasheet(self, datasheet_info: Dict[str, str]) -> bool:
        """Download a datasheet file"""
        try:
            url = datasheet_info['url']
            filename = datasheet_info['filename']
            manufacturer = datasheet_info['manufacturer']
            category = datasheet_info['category']
            part_number = datasheet_info['part_number']
            
            # Create manufacturer subdirectory
            manufacturer_dir = self.output_dir / self.sanitize_filename(manufacturer)
            manufacturer_dir.mkdir(exist_ok=True)
            
            # Sanitize filename
            safe_filename = self.sanitize_filename(filename)
            if not safe_filename.endswith('.pdf'):
                safe_filename += '.pdf'
            
            filepath = manufacturer_dir / safe_filename
            
            # Skip if already exists
            if filepath.exists():
                self.logger.debug(f"File already exists: {manufacturer}/{safe_filename}")
                self.log_download(url, safe_filename, "skipped", manufacturer, category, part_number, 
                                "File already exists")
                return True
            
            # Download the file
            self.logger.info(f"Downloading: {manufacturer}/{safe_filename}")
            
            response = self.session.get(url, timeout=self.timeout)
            response.raise_for_status()
            
            # Validate PDF content
            if len(response.content) < 1000 or b'<html' in response.content[:100].lower():
                raise Exception("Invalid PDF content received")
            
            # Save file
            with open(filepath, 'wb') as f:
                f.write(response.content)
            
            self.log_download(url, safe_filename, "success", manufacturer, category, part_number)
            self.logger.info(f"Successfully downloaded: {manufacturer}/{safe_filename}")
            return True
            
        except Exception as e:
            error_msg = str(e)
            self.logger.error(f"Error downloading {datasheet_info['url']}: {error_msg}")
            self.log_download(datasheet_info['url'], datasheet_info.get('filename', ''), 
                            "error", datasheet_info.get('manufacturer', ''), 
                            datasheet_info.get('category', ''), 
                            datasheet_info.get('part_number', ''), error_msg)
            return False

    def sanitize_filename(self, filename: str) -> str:
        """Sanitize filename for filesystem safety"""
        filename = re.sub(r'[<>:"/\\|?*]', '_', filename)
        filename = re.sub(r'\s+', '_', filename)
        filename = filename.strip('._')
        
        if len(filename) > 200:
            name, ext = os.path.splitext(filename)
            filename = name[:200-len(ext)] + ext
        
        return filename

    def process_products_batch(self, products: List[Dict[str, str]]) -> Dict[str, int]:
        """Process a batch of products"""
        stats = {'success': 0, 'error': 0, 'skipped': 0}
        
        for i, product in enumerate(products, 1):
            try:
                product_url = product['url']
                
                # Skip if already processed
                if product_url in self.downloaded_urls:
                    stats['skipped'] += 1
                    continue
                
                self.logger.debug(f"Processing product {i}/{len(products)}: {product.get('part_number', 'Unknown')}")
                
                # Get datasheet URLs from product page
                datasheets = self.get_datasheet_urls_from_product(product_url, product)
                
                if not datasheets:
                    self.logger.debug(f"No datasheets found for {product.get('part_number', 'Unknown')}")
                    continue
                
                # Download each datasheet
                for datasheet in datasheets:
                    if datasheet['url'] in self.downloaded_urls:
                        stats['skipped'] += 1
                        continue
                    
                    if self.download_datasheet(datasheet):
                        stats['success'] += 1
                        self.downloaded_urls.add(datasheet['url'])
                    else:
                        stats['error'] += 1
                    
                    time.sleep(self.delay * 0.3)
                
                # Mark product as processed
                self.downloaded_urls.add(product_url)
                time.sleep(self.delay * 0.5)
                
            except Exception as e:
                self.logger.error(f"Error processing product {product.get('part_number', 'Unknown')}: {e}")
                stats['error'] += 1
        
        return stats

    def run_scraper(self):
        """Main scraper execution"""
        self.logger.info("Starting FTC Electronics datasheet scraper...")
        
        try:
            # Determine letter range
            start_idx = ALPHABET.index(self.start_letter) if self.start_letter else 0
            end_idx = ALPHABET.index(self.end_letter) if self.end_letter else len(ALPHABET) - 1
            
            letters_to_process = ALPHABET[start_idx:end_idx + 1]
            
            total_stats = self.progress['total_stats'].copy()
            
            # Process each letter
            for letter_idx, letter in enumerate(letters_to_process):
                if letter in self.progress.get('completed_letters', []):
                    self.logger.info(f"Letter {letter} already completed, skipping")
                    continue
                
                self.logger.info(f"Processing letter {letter} ({letter_idx + 1}/{len(letters_to_process)})")
                
                try:
                    # Get manufacturers for this letter
                    manufacturers = self.get_manufacturers_by_letter(letter)
                    
                    if not manufacturers:
                        self.logger.warning(f"No manufacturers found for letter {letter}")
                        # Mark letter as completed even if empty
                        completed_letters = self.progress.get('completed_letters', [])
                        completed_letters.append(letter)
                        self.save_progress(completed_letters=completed_letters)
                        continue
                    
                    # Process each manufacturer
                    for mfg_idx, manufacturer in enumerate(manufacturers):
                        mfg_key = f"{letter}-{manufacturer['slug']}"
                        
                        if mfg_key in self.progress.get('completed_manufacturers', []):
                            self.logger.info(f"Manufacturer {manufacturer['name']} already completed, skipping")
                            continue
                        
                        self.logger.info(f"Processing manufacturer {manufacturer['name']} "
                                       f"({mfg_idx + 1}/{len(manufacturers)} in letter {letter})")
                        
                        try:
                            # Get component categories
                            categories = self.get_component_categories(manufacturer['url'], manufacturer['name'])
                            
                            if not categories:
                                self.logger.warning(f"No categories found for {manufacturer['name']}")
                                # Mark as completed
                                completed_manufacturers = self.progress.get('completed_manufacturers', [])
                                completed_manufacturers.append(mfg_key)
                                self.save_progress(completed_manufacturers=completed_manufacturers)
                                continue
                            
                            # Process each category
                            for cat_idx, category in enumerate(categories):
                                cat_key = f"{mfg_key}-{cat_idx}"
                                
                                if cat_key in self.progress.get('completed_categories', []):
                                    self.logger.info(f"Category {category['name']} already completed, skipping")
                                    continue
                                
                                self.logger.info(f"Processing category {category['name']} "
                                               f"({cat_idx + 1}/{len(categories)})")
                                
                                try:
                                    # Get products from category
                                    products = self.get_products_from_category(
                                        category['url'], category['name'], manufacturer['name']
                                    )
                                    
                                    if not products:
                                        self.logger.warning(f"No products found in {category['name']}")
                                        completed_categories = self.progress.get('completed_categories', [])
                                        completed_categories.append(cat_key)
                                        self.save_progress(completed_categories=completed_categories)
                                        continue
                                    
                                    # Process products in batches
                                    for batch_start in range(0, len(products), self.batch_size):
                                        batch_end = min(batch_start + self.batch_size, len(products))
                                        batch = products[batch_start:batch_end]
                                        
                                        self.logger.info(f"Processing batch {batch_start//self.batch_size + 1} "
                                                       f"({batch_start + 1}-{batch_end} of {len(products)})")
                                        
                                        batch_stats = self.process_products_batch(batch)
                                        
                                        # Update total stats
                                        for key in batch_stats:
                                            total_stats[key] += batch_stats[key]
                                        
                                        self.logger.info(f"Batch complete: {batch_stats}")
                                        
                                        # Save progress
                                        self.save_progress(stats=batch_stats)
                                        
                                        # Delay between batches
                                        if batch_end < len(products):
                                            time.sleep(self.delay * 2)
                                    
                                    # Mark category as completed
                                    completed_categories = self.progress.get('completed_categories', [])
                                    completed_categories.append(cat_key)
                                    self.save_progress(completed_categories=completed_categories)
                                    
                                except Exception as e:
                                    self.logger.error(f"Error processing category {category['name']}: {e}")
                                    continue
                            
                            # Mark manufacturer as completed
                            completed_manufacturers = self.progress.get('completed_manufacturers', [])
                            completed_manufacturers.append(mfg_key)
                            self.save_progress(completed_manufacturers=completed_manufacturers)
                            
                        except Exception as e:
                            self.logger.error(f"Error processing manufacturer {manufacturer['name']}: {e}")
                            continue
                    
                    # Mark letter as completed
                    completed_letters = self.progress.get('completed_letters', [])
                    completed_letters.append(letter)
                    self.save_progress(completed_letters=completed_letters)
                    
                except Exception as e:
                    self.logger.error(f"Error processing letter {letter}: {e}")
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
        description="Scrape datasheets from ftcelectronics.com following A-Z manufacturer navigation",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python ftc_electronics_scraper.py -o ./ftc_datasheets
  python ftc_electronics_scraper.py -o ./datasheets --start-letter A --end-letter C
  python ftc_electronics_scraper.py -o ./datasheets --start-letter M --batch-size 15 --delay 2.0
  python ftc_electronics_scraper.py -o ./output --verbose --test-mode
        """
    )
    
    parser.add_argument(
        '-o', '--output-dir',
        required=True,
        help='Output directory for downloaded datasheets'
    )
    
    parser.add_argument(
        '--start-letter',
        help='Starting letter for manufacturer processing (A-Z)'
    )
    
    parser.add_argument(
        '--end-letter', 
        help='Ending letter for manufacturer processing (A-Z)'
    )
    
    parser.add_argument(
        '--batch-size',
        type=int,
        default=DEFAULT_BATCH_SIZE,
        help=f'Number of products to process per batch (default: {DEFAULT_BATCH_SIZE})'
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
        '--test-mode',
        action='store_true',
        help='Run in test mode (limited processing for validation)'
    )
    
    parser.add_argument(
        '--reset-progress',
        action='store_true',
        help='Reset progress and start from beginning'
    )
    
    parser.add_argument(
        '--version',
        action='version',
        version=f'FTC Electronics Datasheet Scraper v{SCRIPT_VERSION}'
    )
    
    args = parser.parse_args()
    
    # Validate arguments
    if args.batch_size <= 0:
        print("Error: batch-size must be positive", file=sys.stderr)
        return 1
        
    if args.delay < 0:
        print("Error: delay cannot be negative", file=sys.stderr)
        return 1
        
    if args.start_letter and (len(args.start_letter) != 1 or args.start_letter not in ALPHABET):
        print("Error: start-letter must be a single letter A-Z", file=sys.stderr)
        return 1
        
    if args.end_letter and (len(args.end_letter) != 1 or args.end_letter not in ALPHABET):
        print("Error: end-letter must be a single letter A-Z", file=sys.stderr)
        return 1
        
    if (args.start_letter and args.end_letter and 
        ALPHABET.index(args.start_letter) > ALPHABET.index(args.end_letter)):
        print("Error: start-letter must come before end-letter", file=sys.stderr)
        return 1
        
    try:
        # Reset progress if requested
        if args.reset_progress:
            progress_file = Path(args.output_dir) / "scraper_progress.json"
            if progress_file.exists():
                progress_file.unlink()
                print("Progress reset successfully")
        
        # Create scraper instance
        scraper = FTCElectronicsScraper(
            output_dir=args.output_dir,
            batch_size=args.batch_size,
            delay=args.delay,
            timeout=args.timeout,
            start_letter=args.start_letter,
            end_letter=args.end_letter
        )
        
        # Set verbose logging if requested
        if args.verbose:
            scraper.logger.setLevel(logging.DEBUG)
        
        # Apply test mode limits if requested
        if args.test_mode:
            scraper.batch_size = min(scraper.batch_size, 5)
            scraper.logger.info("Test mode: Limited batch sizes and processing")
        
        # Run the scraper
        scraper.run_scraper()
        return 0
        
    except Exception as e:
        print(f"Fatal error: {e}", file=sys.stderr)
        return 1

if __name__ == "__main__":
    sys.exit(main())