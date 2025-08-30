import os
import json
import time
import urllib.robotparser
from urllib.parse import urlparse, urljoin
import requests
from bs4 import BeautifulSoup
from pathlib import Path

HEADERS = {"User-Agent": "Mozilla/5.0"}
OUTPUT_DIR = "downloaded_datasheets"
MAX_LINKS_PER_SITE = 20
ROBOTS_CACHE = {}


def load_targets(filepath):
    with open(filepath, "r") as f:
        return json.load(f)


def is_allowed_by_robots(url):
    domain = urlparse(url).netloc
    if domain in ROBOTS_CACHE:
        rp = ROBOTS_CACHE[domain]
    else:
        rp = urllib.robotparser.RobotFileParser()
        try:
            rp.set_url(f"https://{domain}/robots.txt")
            rp.read()
            ROBOTS_CACHE[domain] = rp
        except:
            return False
    return rp.can_fetch("*", url)


def extract_pdf_links(base_url):
    try:
        if not is_allowed_by_robots(base_url):
            print(f"[!] Blocked by robots.txt: {base_url}")
            return []

        print(f"[~] Crawling: {base_url}")
        r = requests.get(base_url, headers=HEADERS, timeout=10)
        soup = BeautifulSoup(r.text, "html.parser")

        pdf_links = []
        for link in soup.find_all("a", href=True):
            href = link["href"]
            if ".pdf" in href.lower():
                full_url = urljoin(base_url, href)
                if is_allowed_by_robots(full_url):
                    pdf_links.append(full_url)
            if len(pdf_links) >= MAX_LINKS_PER_SITE:
                break
        return pdf_links
    except Exception as e:
        print(f"[!] Error crawling {base_url}: {e}")
        return []


def download_pdf(url, out_dir):
    try:
        r = requests.get(url, headers=HEADERS, timeout=10)
        if r.headers.get("content-type", "").startswith("application/pdf"):
            filename = url.split("/")[-1].split("?")[0] or "unnamed.pdf"
            Path(out_dir).mkdir(parents=True, exist_ok=True)
            filepath = os.path.join(out_dir, filename)
            with open(filepath, "wb") as f:
                f.write(r.content)
            print(f"[+] Saved: {filepath}")
        else:
            print(f"[-] Not a PDF: {url}")
    except Exception as e:
        print(f"[!] Failed to download {url}: {e}")


def main():
    targets = load_targets("crawl_targets.json")
    for entry in targets:
        name = entry["name"]
        site = entry["website"]
        category = entry["category"]
        print(f"\n=== {name} ({category}) ===")
        pdf_links = extract_pdf_links(site)
        for link in pdf_links:
            download_pdf(link, os.path.join(OUTPUT_DIR, name.replace(" ", "_")))
        time.sleep(2)  # be polite


if __name__ == "__main__":
    main()








    def browse_manufacturers(self):
        """Discover datasheets by browsing manufacturer pages"""
        manufacturers = []
        urls = set()
        
        try:
            # Get manufacturer list
            response = self.session.get(f"{self.base_url}/manufacturers/", timeout=30)
            if response.status_code == 200:
                soup = BeautifulSoup(response.text, 'html.parser')
                
                # Look for manufacturer links
                links = soup.find_all('a', href=True)
                for link in links:
                    href = link['href']
                    if re.match(r'^/[^/]+/?$', href) and len(href) > 3:
                        manufacturers.append(href.strip('/'))
            
            self.logger.info(f"Found {len(manufacturers)} manufacturers")
            
            # Browse each manufacturer
            for i, manufacturer in enumerate(manufacturers, 1):
                self.logger.info(f"Browsing manufacturer {i}/{len(manufacturers)}: {manufacturer}")
                
                try:
                    mfg_url = f"{self.base_url}/{manufacturer}/"
                    response = self.session.get(mfg_url, timeout=30)
                    if response.status_code == 200:
                        mfg_urls = self._extract_datasheet_urls(response.text)
                        urls.update(mfg_urls)
                        self.logger.info(f"  Found {len(mfg_urls)} datasheets")
                    
                    time.sleep(1)  # Be respectful
                    
                except Exception as e:
                    self.logger.error(f"Error browsing {manufacturer}: {e}")
                    continue
                    
        except Exception as e:
            self.logger.error(f"Error getting manufacturers: {e}")
        
        return list(urls)