import requests
import xml.etree.ElementTree as ET

url = "https://georisques.gouv.fr/services?SERVICE=WFS&REQUEST=GetCapabilities"
try:
    print("Fetching capabilities...")
    resp = requests.get(url, timeout=15)
    resp.raise_for_status()
    print("Parsing XML...")
    root = ET.fromstring(resp.content)
    
    # Simple search for 'inondation'
    namespaces = {'wfs': 'http://www.opengis.net/wfs'}
    
    layer_names = []
    # WFS 1.1.0 / 2.0.0 might use different structures, let's just do a text search
    xml_str = resp.text.lower()
    lines = xml_str.split('\n')
    for i, line in enumerate(lines):
        if 'inondation' in line or 'eaip' in line:
            print(f"Found on line {i}: {line.strip()[:200]}")
            
except Exception as e:
    print(f"Error: {e}")
