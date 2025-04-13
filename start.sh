#!/bin/bash
# 重启脚本 - 停止已有进程并启动Cursor Planner API服务和前端静态服务器

# 加载环境变量
source .env

# 获取后端端口号，默认为8000
BACKEND_PORT=${BACKEND_PORT:-8000}
FRONTEND_PORT=${WEB_PORT:-3000}

# 日志文件
FRONTEND_LOG="frontend_server.log"
rm -f $FRONTEND_LOG # 清除旧日志

echo "后端端口: $BACKEND_PORT, 前端端口: $FRONTEND_PORT"

# 停止函数
kill_process_on_port() {
    local port=$1
    echo "检查端口 $port ..."
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS系统
        PID=$(lsof -i :$port -t 2>/dev/null) # 增加错误重定向
        if [ ! -z "$PID" ]; then
            echo "发现端口 $port 被进程 $PID 占用，正在终止..."
            kill -9 $PID
            echo "进程已终止"
        else
            echo "端口 $port 没有被占用"
        fi
    else
        # Linux/其他系统
        PID=$(netstat -tulpn 2>/dev/null | grep ":$port" | awk '{print $7}' | cut -d'/' -f1)
        if [ ! -z "$PID" ]; then
            echo "发现端口 $port 被进程 $PID 占用，正在终止..."
            kill -9 $PID
            echo "进程已终止"
        else
            echo "端口 $port 没有被占用"
        fi
    fi
}

# 停止现有服务
kill_process_on_port $BACKEND_PORT
kill_process_on_port $FRONTEND_PORT

# 确保数据目录存在
mkdir -p data

# 启动后端API服务器 (后台)
cd backend
# 检查虚拟环境是否存在
if [ -d "venv" ]; then
    source venv/bin/activate
    echo "已激活后端虚拟环境"
else
    echo "警告：未找到后端的 venv 目录，将尝试直接运行 uvicorn。"
fi

# 启动uvicorn并在后台运行 (错误输出也打印到终端)
python -m uvicorn app.main:app --reload --port $BACKEND_PORT &
API_PID=$!
echo "API服务器进程ID: $API_PID"
if [ -f "venv/bin/activate" ]; then # 仅当虚拟环境存在时才停用
    deactivate
fi
cd .. # 返回项目根目录

# 等待API服务器启动
echo "等待API服务器启动..."
sleep 3

# 检查API服务器是否仍在运行
if ! kill -0 $API_PID 2>/dev/null; then
    echo "错误：后端API服务器未能成功启动或已退出！请检查后端日志。"
    exit 1
fi

# 启动前端静态服务器 (后台，并将输出重定向到日志文件)
python web_server.py >> "$FRONTEND_LOG" 2>&1 &
FRONTEND_PID=$!
echo "前端服务器进程ID: $FRONTEND_PID (日志文件: $FRONTEND_LOG)"

# 短暂等待，检查前端服务器是否仍在运行
sleep 1
if ! kill -0 $FRONTEND_PID 2>/dev/null; then
    echo "错误：前端服务器未能成功启动或已退出！请检查日志文件 $FRONTEND_LOG。"
    # 如果后端仍在运行，尝试清理
    if kill -0 $API_PID 2>/dev/null; then
        echo "正在停止后端API服务器..."
        kill $API_PID
    fi
    exit 1
fi

# 捕获Ctrl+C并清理后台进程
trap "echo '正在关闭服务...'; kill $API_PID $FRONTEND_PID; exit" INT TERM

# 脚本会因为前台的Python命令而保持运行，直到被中断
echo "服务已启动，访问 http://localhost:$FRONTEND_PORT 查看前端界面。按 Ctrl+C 停止"
# 使用wait等待后台进程，使脚本保持运行状态，等待中断信号
wait $API_PID
wait $FRONTEND_PID
echo "所有服务已停止"