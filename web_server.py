import os
import http.server
import socketserver
import sys
import re
from dotenv import load_dotenv
# 配置

load_dotenv()
WEB_PORT = int(os.getenv("WEB_PORT", 3000))
BACKEND_PORT = int(os.getenv("BACKEND_PORT", 8000))
DIRECTORY = os.path.join(os.path.dirname(os.path.abspath(__file__)), "web")

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def do_GET(self):
        # 对于根路径，确保服务index.html
        if self.path == '/':
            self.path = '/index.html'
        
        # 如果是请求HTML文件，注入端口配置
        if self.path.endswith('.html'):
            self.send_response(200)
            self.send_header('Content-type', 'text/html')
            self.end_headers()
            
            # 读取HTML文件
            file_path = os.path.join(DIRECTORY, self.path.lstrip('/'))
            with open(file_path, 'r', encoding='utf-8') as file:
                content = file.read()
            
            # 注入配置脚本，在</head>标签前
            config_script = f'<script>window.CODE_DOCK_CONFIG = {{ API_PORT: {BACKEND_PORT} }};</script>'
            content = content.replace('</head>', f'{config_script}\n</head>')
            
            # 发送修改后的内容
            self.wfile.write(content.encode())
            return
        
        return super().do_GET()

def run_server():
    """运行HTTP服务器"""
    # 使用 ThreadingHTTPServer 以便能处理 Ctrl+C
    with socketserver.ThreadingTCPServer(("", WEB_PORT), Handler) as httpd:
        print(f"前端服务器启动在 http://localhost:{WEB_PORT}")
        print(f"后端服务器地址: http://localhost:{BACKEND_PORT}")
        print(f"服务目录: {DIRECTORY}")
        print("按 Ctrl+C 停止服务器")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n前端服务器停止")
            httpd.server_close()
            sys.exit(0)

if __name__ == "__main__":
    run_server() 