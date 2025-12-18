#!/usr/bin/env python3
"""
Run AI Gap Filler with proper encoding handling
"""

import sys
import os
import asyncio

# Set encoding for Windows console
if sys.platform == 'win32':
    import locale
    os.system('chcp 65001 >nul')

    # Set UTF-8 encoding
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

# Import and run the main function
from ai_gap_standalone import main

if __name__ == "__main__":
    asyncio.run(main())