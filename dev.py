"""Serve okapi locally with the same URL prefix as production."""
import os
from pathlib import Path

from aiohttp import web

import server


def index(_request):
    raise web.HTTPFound('/okapi/')


def main():
    data = Path(os.environ.get('OKAPI_LOCAL_DATA', server.ROOT / '.local' / 'comfy-data'))
    server.INPUT = data / 'input' / 'okapi'
    server.OUTPUT_DIR = data / 'output' / 'okapi'

    app = web.Application()
    app.router.add_get('/', index)
    app.router.add_get('/okapi', index)
    app.add_subapp('/okapi', server.make_app())
    web.run_app(app, host='127.0.0.1', port=int(os.environ.get('OKAPI_PORT', '18769')))


if __name__ == '__main__':
    main()
