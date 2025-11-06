# 依赖安装指南

## 阶段1：基础图像处理依赖

### 必须安装的Python库：

```bash
# 方法1：使用pip（推荐）
pip3 install opencv-python numpy matplotlib pillow --break-system-packages

# 或者方法2：使用apt安装系统包（更稳定）
sudo apt update
sudo apt install python3-opencv python3-numpy python3-matplotlib python3-pil
```

### 验证安装：

```bash
python3 -c "import cv2; print('OpenCV:', cv2.__version__)"
python3 -c "import numpy; print('NumPy:', numpy.__version__)"
python3 -c "import matplotlib; print('Matplotlib:', matplotlib.__version__)"
python3 -c "from PIL import Image; print('Pillow: OK')"
```

如果都没有报错，说明基础依赖安装成功！

---

## 阶段2：Cellpose和StarDist（稍后安装）

等基础依赖安装好后再安装这些：

```bash
# Cellpose（细胞分割）
pip3 install cellpose --break-system-packages

# StarDist（细胞核检测）
pip3 install stardist --break-system-packages

# 深度学习依赖（Cellpose和StarDist需要）
pip3 install torch torchvision --break-system-packages
# 或者只用CPU版本：
pip3 install torch torchvision --index-url https://download.pytorch.org/whl/cpu --break-system-packages
```

---

## 当前任务清单

### ✅ 第一步（现在）：安装基础依赖
```bash
# 你只需要运行这个命令：
pip3 install opencv-python numpy matplotlib pillow --break-system-packages
```

### ⏳ 第二步（安装好后告诉我）：
我会运行图像裁剪脚本，分离原始图和标注图

### ⏳ 第三步：安装Cellpose和StarDist
等图像处理好后再安装

### ⏳ 第四步：运行测试和可视化对比

---

## 遇到问题？

### 如果pip安装很慢：
```bash
# 使用清华镜像源
pip3 install opencv-python numpy matplotlib pillow -i https://pypi.tuna.tsinghua.edu.cn/simple --break-system-packages
```

### 如果提示权限问题：
```bash
# 使用sudo（不推荐，但可以尝试）
sudo pip3 install opencv-python numpy matplotlib pillow
```

### 如果pip版本太低：
```bash
pip3 install --upgrade pip --break-system-packages
```

---

## 完成后告诉我！

安装好基础依赖后，运行这个验证：
```bash
python3 -c "import cv2; import numpy; import matplotlib; from PIL import Image; print('所有依赖安装成功！')"
```

如果看到"所有依赖安装成功！"，就可以继续了！
