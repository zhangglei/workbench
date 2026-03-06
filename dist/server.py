#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
工作台 HTTP 服务器 - 长时间后台运行，供本机与局域网内他人访问
运行: python server.py
绑定 0.0.0.0，可用本机 IP 访问，建议在路由器或系统中为该设备设置固定 IP 以保持地址不变
"""

import os
import socket
import sys
from http.server import HTTPServer, SimpleHTTPRequestHandler

PORT = int(os.environ.get("PORT", "8765"))
ROOT = os.path.dirname(os.path.abspath(__file__))


def get_local_ips():
    ips = []
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            s.connect(("8.8.8.8", 80))
            ips.append(s.getsockname()[0])
    except Exception:
        pass
    try:
        host = socket.gethostname()
        ip = socket.gethostbyname(host)
        if ip and not ip.startswith("127.") and ip not in ips:
            ips.append(ip)
    except Exception:
        pass
    return ips


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def log_message(self, format, *args):
        pass  # 可选：不打印每条请求，减少刷屏


def main():
    os.chdir(ROOT)
    server = HTTPServer(("0.0.0.0", PORT), Handler)
    ips = get_local_ips()
    print()
    print("  工作台已启动，可长期在后台运行")
    print("  本机访问:  http://localhost:" + str(PORT))
    if ips:
        print("  局域网访问（他人可访问）:")
        for ip in ips:
            print("    http://" + ip + ":" + str(PORT))
        print()
        print("  建议在路由器中为本机设置「固定 IP / DHCP 保留」，这样上述地址不会变。")
    print("  按 Ctrl+C 停止服务")
    print()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        server.shutdown()
        sys.exit(0)


if __name__ == "__main__":
    main()
