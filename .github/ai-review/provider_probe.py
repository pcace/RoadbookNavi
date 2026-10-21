#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-only
"""One fixed-free request, logging only allowlisted diagnostic fields."""
import json
import os
import re
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from common import MODEL


def category(message, status=None):
    text = str(message).lower()
    if 'free-models-per-day' in text or ('daily' in text and ('quota' in text or 'limit' in text)):
        return 'free_daily_quota_exhausted'
    if status == 429 or 'rate limit' in text or 'rate_limit' in text:
        return 'provider_rate_limited'
    if status == 401:
        return 'authentication_failed'
    if status == 402:
        return 'provider_credit_limit'
    if status in (500, 502, 503, 504):
        return 'provider_unavailable'
    if 'context' in text and ('length' in text or 'limit' in text):
        return 'context_limit'
    if status == 404:
        return 'model_unavailable'
    return 'provider_request_failed'


def probe():
    payload = {'model': MODEL, 'messages': [{'role': 'user', 'content': 'Reply OK.'}],
               'max_tokens': 12000, 'provider': {'max_price': {'prompt': 0, 'completion': 0}}}
    request = Request('https://openrouter.ai/api/v1/chat/completions', method='POST',
                      data=json.dumps(payload).encode(), headers={
                          'Authorization': 'Bearer ' + os.environ['OPENROUTER_API_KEY'],
                          'Content-Type': 'application/json'})
    try:
        with urlopen(request, timeout=45) as response:
            json.load(response)
        report = {'http_status': 200, 'category': 'provider_available', 'requested_model': MODEL}
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
    except URLError:
        report = {'category': 'network_or_tls_error', 'requested_model': MODEL}
    print(json.dumps(report))


if __name__ == '__main__':
    probe()
