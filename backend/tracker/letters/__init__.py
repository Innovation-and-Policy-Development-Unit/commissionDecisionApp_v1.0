"""
Structured outcome letter generation for PSC submission types.
Each module returns a dict with keys: subject, body_text, body_html.
"""
from .dispatcher import generate_letter

__all__ = ['generate_letter']
