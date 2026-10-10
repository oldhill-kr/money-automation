# 로컬 확인용 서버: 브라우저가 옛 JS를 캐시하지 않도록 no-store 헤더를 붙인다.
import http.server, functools, sys
class H(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()
port = int(sys.argv[1]) if len(sys.argv) > 1 else 8791
http.server.ThreadingHTTPServer(('127.0.0.1', port), H).serve_forever()
