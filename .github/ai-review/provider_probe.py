#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-only
"""One fixed-free request, logging only allowlisted diagnostic fields."""
import json
import os
import re
import sys
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from common import MODEL
from diagnostics import category


def probe():
    payload = {'model': MODEL, 'messages': [{'role': 'user', 'content': 'Reply OK.'}],
               'max_tokens': 12000, 'provider': {'max_price': {'prompt': 0, 'completion': 0}}}
    request = Request('https://openrouter.ai/api/v1/chat/completions', method='POST',
                      data=json.dumps(payload).encode(), headers={
                          'Authorization': 'Bearer ' + os.environ['OPENROUTER_API_KEY'],
                          'Content-Type': 'application/json'})
    try:
        with urlopen(request, timeout=45) as response:
            value = json.load(response)
        if isinstance(value, dict) and value.get('error'):
            report = {'http_status': 200, 'category': category(value), 'requested_model': MODEL}
        elif isinstance(value, dict) and isinstance(value.get('choices'), list) and value['choices']:
            report = {'http_status': 200, 'category': 'provider_available', 'requested_model': MODEL}
        else:
            report = {'http_status': 200, 'category': 'invalid_provider_response', 'requested_model': MODEL}
    except HTTPError as error:
        try:
            value = json.loads(error.read(1_000_000))
        except (ValueError, UnicodeDecodeError):
            value = {}
        report = {'http_status': error.code, 'category': category(value, error.code), 'requested_model': MODEL}
        for header in ('Retry-After', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'):
            value = error.headers.get(header, '')
            if re.fullmatch(r'[0-9]{1,16}', value):
                report[header.lower()] = value
    except (URLError, TimeoutError, OSError):
        report = {'category': 'network_or_tls_error', 'requested_model': MODEL}
    except (ValueError, UnicodeDecodeError):
        report = {'category': 'invalid_provider_response', 'requested_model': MODEL}
    return report


if __name__ == '__main__':
    report = probe()
    print(json.dumps(report))
    sys.exit(0 if report['category'] == 'provider_available' else 1)
