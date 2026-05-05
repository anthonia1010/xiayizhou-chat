# Git 上传脚本
# 请在 PowerShell 中运行此脚本

Write-Host "正在初始化 Git 仓库..."

# 检查 git 是否可用
$gitCmd = Get-Command git -ErrorAction SilentlyContinue
if (-not $gitCmd) {
    Write-Host "Git 未找到，请确保已安装 Git 并重新打开终端"
    Write-Host "或者尝试: refreshenv"
    exit 1
}

# 初始化
git init

# 添加文件
git add .

# 提交
git commit -m "feat: 夏以昼智能对话网站"

Write-Host ""
Write-Host "Git 仓库初始化完成！"
Write-Host ""
Write-Host "下一步，请执行以下命令连接远程仓库："
Write-Host 'git remote add origin https://github.com/您的用户名/仓库名.git'
Write-Host "git push -u origin master"
