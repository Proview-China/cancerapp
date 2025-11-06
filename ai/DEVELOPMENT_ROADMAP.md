# AI病理分析系统完整开发路线图

## 你的理解总结（✅ 基本正确！）

```
图片输入
    ↓
YOLO识别细胞位置
    ↓
MobileNet切图分割
    ↓
定量分析模块
├─ 物理尺寸
├─ 核质比
├─ 颜色HSI量化
└─ 形态提取
    ↓
检测模块（大小量化置信值）
    ↓
指标计算（H-Score、IRS等）
    ↓
C2S-Scale-Gemma-2-2B（图像理解）
    ↓
Qwen-Agent综合医学判断
    ↓
最终报告
```

**✅ 流程完全正确！**

但有一个关键问题：

---

## ⚠️ YOLO和MobileNet必须训练！

### 为什么必须训练？

**通用预训练模型的局限性：**

```python
# COCO数据集预训练的YOLOv8能检测的物体：
预训练YOLO = [人, 车, 猫, 狗, 桌子, 椅子, ...]

# 你需要检测的：
你的需求 = [肝细胞, 细胞核, 癌细胞, ...]

# 结论：完全不匹配！❌
```

**病理图像的特殊性：**
- 显微镜图像 ≠ 自然图像
- 细胞 ≠ 日常物体
- 免疫组化染色 ≠ 普通照片

**必须用你的病理图像数据重新训练（或微调）！**

---

## 完整开发路线图

---

## 阶段1：项目初始化和环境搭建

### 时间：1-2天

### 需要做什么：

#### 1.1 创建项目结构
```bash
cd /home/proview/Desktop/Coder/cancerapp/ai

# 创建目录结构
mkdir -p {data,models,src,configs,notebooks,outputs}
mkdir -p data/{raw,annotated,train,val,test}
mkdir -p models/{yolo,mobilenet,classifiers,vlm,llm}
mkdir -p src/{detection,segmentation,analysis,agent}
```

#### 1.2 安装依赖
```bash
# 创建虚拟环境
python3 -m venv venv
source venv/bin/activate

# 安装核心库
pip install torch torchvision  # PyTorch
pip install ultralytics  # YOLOv8
pip install opencv-python numpy scipy scikit-learn
pip install transformers accelerate  # Hugging Face
pip install qwen-agent  # Qwen Agent框架
```

#### 1.3 配置文件
创建 `configs/config.yaml`：
```yaml
# 数据配置
data:
  pixel_to_micron_ratio: 10  # 像素到微米转换（取决于放大倍数）
  image_size: 640

# 模型配置
models:
  yolo:
    model_size: 'yolov8n'  # nano版本，7840HS能跑
    epochs: 100
    batch_size: 8

  mobilenet:
    backbone: 'mobilenetv3_small'
    epochs: 50
    batch_size: 4

# 阈值配置
thresholds:
  normal_cell_diameter: 18  # μm
  normal_cell_std: 2
  nc_ratio_normal: 0.25
```

**输出：✅ 项目环境搭建完成**

---

## 阶段2：数据准备和标注（最重要！）⭐⭐⭐

### 时间：1-2周（取决于数据量）

### 为什么这是最重要的阶段？

**AI训练的铁律：Garbage In, Garbage Out**

没有高质量的标注数据 → 模型无法学习 → 整个系统失败

### 需要做什么：

#### 2.1 收集病理切片图像

**最小数据集（MVP）：**
```
训练集：300-500张病理切片图像
验证集：50-100张
测试集：50-100张
━━━━━━━━━━━━━━━━━━━━━
总计：400-700张图像
```

**推荐数据集：**
```
训练集：1000-2000张
验证集：200张
测试集：200张
━━━━━━━━━━━━━━━━━━━━━
总计：1400-2400张图像
```

**数据来源：**
- 医院病理科存档切片
- 公开数据集（如有）
- 合作医疗机构

#### 2.2 数据标注（需要专业病理医生参与！）

**标注内容：**

##### 任务A：YOLO细胞检测标注
```
工具：LabelImg 或 CVAT
格式：YOLO格式

每个细胞标注一个边界框：
[class_id, x_center, y_center, width, height]

示例：
0 0.5234 0.6123 0.0234 0.0198  # 细胞1
0 0.6012 0.5987 0.0256 0.0213  # 细胞2
...
```

##### 任务B：MobileNet分割标注
```
工具：LabelMe 或 Labelbox
格式：Mask图像

需要标注：
1. 整个细胞的轮廓 → cell_mask.png
2. 细胞核的轮廓 → nucleus_mask.png

示例：
image_001.jpg
  ├─ image_001_cells.png      # 所有细胞的mask
  └─ image_001_nuclei.png     # 所有细胞核的mask
```

##### 任务C：细胞分类标注
```
工具：自定义标注界面 或 Excel

为每个细胞标注：
1. 阳性等级：0=阴性, 1=弱阳性, 2=中度, 3=强阳性
2. 是否癌细胞：0=正常, 1=可疑, 2=癌细胞

示例CSV：
cell_id, image_name, bbox, positivity_grade, is_cancer
1, img_001.jpg, [100,200,30,30], 2, 0
2, img_001.jpg, [150,220,28,32], 3, 1
...
```

#### 2.3 数据标注工具推荐

| 任务 | 工具 | 优点 | 缺点 |
|------|------|------|------|
| YOLO标注 | [LabelImg](https://github.com/heartexlabs/labelImg) | 简单易用 | 只支持框标注 |
| 分割标注 | [LabelMe](https://github.com/wkentaro/labelme) | 支持多边形 | 需要手动勾勒 |
| 分割标注 | [SAM辅助标注](https://segment-anything.com/) | 半自动，快速 | 需要后处理 |
| 全流程 | [CVAT](https://www.cvat.ai/) | 功能全面 | 学习曲线陡 |

#### 2.4 数据标注流程（实际操作）

```bash
# 假设你有100张原始图像
cd ai/data/raw/
ls *.jpg | wc -l  # 100

# Step 1: YOLO标注（医生用LabelImg标注）
# 输出：每张图对应一个txt文件
raw/
├─ image_001.jpg
├─ image_001.txt  # YOLO格式标注
├─ image_002.jpg
├─ image_002.txt
...

# Step 2: 分割标注（医生用LabelMe标注）
# 输出：JSON格式
annotated/
├─ image_001.json  # 包含细胞和细胞核的多边形
├─ image_002.json
...

# Step 3: 转换为训练格式（写脚本自动化）
python src/data_preprocessing/convert_annotations.py
```

#### 2.5 辅助标注：用预训练模型加速

**策略：先用通用模型预标注 → 医生修正**

```python
# 使用Cellpose预训练模型快速生成初始mask
from cellpose import models

model = models.Cellpose(gpu=False, model_type='cyto')

for image_path in image_list:
    image = cv2.imread(image_path)

    # 自动分割
    masks, flows, styles, diams = model.eval(image, diameter=30, channels=[0,0])

    # 保存为初始标注
    save_initial_annotation(masks, image_path)

# 医生只需要修正错误，不用从零开始标注
# 可以节省50-70%的标注时间！
```

**输出：✅ 标注好的训练数据集**

```
data/
├─ train/
│   ├─ images/  (400张)
│   ├─ labels/  (YOLO格式)
│   └─ masks/   (分割mask)
├─ val/
│   ├─ images/  (50张)
│   ├─ labels/
│   └─ masks/
└─ test/
    ├─ images/  (50张)
    ├─ labels/
    └─ masks/
```

---

## 阶段3：YOLO细胞检测模型训练

### 时间：1-3天（取决于数据量和硬件）

### 需要做什么：

#### 3.1 准备YOLO训练配置

创建 `configs/cell_detection.yaml`：
```yaml
# YOLO数据集配置
path: /home/proview/Desktop/Coder/cancerapp/ai/data
train: train/images
val: val/images
test: test/images

# 类别
nc: 1  # 只有一个类：细胞
names: ['cell']
```

#### 3.2 训练脚本

创建 `src/detection/train_yolo.py`：
```python
from ultralytics import YOLO
import torch

# 检查是否有GPU（7840HS没有独显，用CPU）
device = 'cuda' if torch.cuda.is_available() else 'cpu'
print(f"Using device: {device}")

# 加载预训练模型（使用最小的nano版本）
model = YOLO('yolov8n.pt')

# 训练配置
model.train(
    data='configs/cell_detection.yaml',
    epochs=100,
    imgsz=640,
    batch=8,  # 7840HS可以处理
    device=device,
    workers=8,  # 7840HS有8核
    project='models/yolo',
    name='cell_detector',
    patience=20,  # 早停
    save=True,
    plots=True
)

# 验证
metrics = model.val()
print(f"mAP50: {metrics.box.map50}")
print(f"mAP50-95: {metrics.box.map}")
```

#### 3.3 运行训练

```bash
cd /home/proview/Desktop/Coder/cancerapp/ai
source venv/bin/activate

# 开始训练（预计2-4小时，取决于数据量）
python src/detection/train_yolo.py

# 训练过程会自动保存到：
# models/yolo/cell_detector/weights/best.pt
```

#### 3.4 评估模型

```python
# 测试检测效果
from ultralytics import YOLO

model = YOLO('models/yolo/cell_detector/weights/best.pt')

# 在测试集上评估
results = model.val()

# 在单张图像上测试
test_image = 'data/test/images/test_001.jpg'
result = model.predict(test_image)

# 可视化
result[0].plot()
result[0].save('outputs/test_detection.jpg')
```

**关键指标：**
- mAP50 > 0.85：优秀
- mAP50 > 0.75：良好
- mAP50 < 0.65：需要更多数据或调参

**如果7840HS训练太慢怎么办？**

```bash
# 方案A：云端训练（推荐）
# 使用Google Colab免费GPU
# 或租用AutoDL/恒星GPU（1-2元/小时）

# 方案B：减少数据量
# 先用100张图像快速验证流程
# 确认可行后再扩大数据集

# 方案C：使用更小的模型
model = YOLO('yolov8n.pt')  # nano: 最小
# model = YOLO('yolov8s.pt')  # small: 较小
```

**输出：✅ 训练好的YOLO细胞检测模型**

```
models/yolo/cell_detector/
├─ weights/
│   ├─ best.pt       # 最佳模型
│   └─ last.pt       # 最后一轮
├─ results.png       # 训练曲线
└─ confusion_matrix.png
```

---

## 阶段4：MobileNet细胞分割模型训练

### 时间：2-4天

### 需要做什么：

#### 4.1 构建MobileNet-UNet模型

创建 `src/segmentation/mobilenet_unet.py`：
```python
import torch
import torch.nn as nn
from torchvision.models import mobilenet_v3_small

class MobileNetUNet(nn.Module):
    """
    轻量级分割模型：MobileNetV3 + UNet
    适合7840HS这样的CPU/集成显卡
    """
    def __init__(self, num_classes=2):
        super().__init__()

        # 使用预训练的MobileNetV3作为编码器
        mobilenet = mobilenet_v3_small(pretrained=True)
        self.encoder = mobilenet.features

        # UNet解码器
        self.decoder = nn.ModuleList([
            # 上采样层
            nn.ConvTranspose2d(576, 256, 2, stride=2),
            nn.ConvTranspose2d(256, 128, 2, stride=2),
            nn.ConvTranspose2d(128, 64, 2, stride=2),
            nn.ConvTranspose2d(64, 32, 2, stride=2),
        ])

        # 最终分类层
        self.final_conv = nn.Conv2d(32, num_classes, 1)

    def forward(self, x):
        # 编码
        features = []
        for module in self.encoder:
            x = module(x)
            features.append(x)

        # 解码
        for i, decoder_layer in enumerate(self.decoder):
            x = decoder_layer(x)
            # 可以添加skip connection

        # 输出
        x = self.final_conv(x)
        return x
```

#### 4.2 数据加载器

创建 `src/segmentation/dataset.py`：
```python
import torch
from torch.utils.data import Dataset
import cv2
import numpy as np

class CellSegmentationDataset(Dataset):
    def __init__(self, image_dir, mask_dir, transform=None):
        self.image_paths = glob.glob(f"{image_dir}/*.jpg")
        self.mask_dir = mask_dir
        self.transform = transform

    def __len__(self):
        return len(self.image_paths)

    def __getitem__(self, idx):
        # 读取图像
        image = cv2.imread(self.image_paths[idx])
        image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)

        # 读取mask
        mask_path = self.image_paths[idx].replace('images', 'masks').replace('.jpg', '.png')
        mask = cv2.imread(mask_path, cv2.IMREAD_GRAYSCALE)

        # 转换为tensor
        if self.transform:
            image, mask = self.transform(image, mask)

        return image, mask
```

#### 4.3 训练脚本

创建 `src/segmentation/train_segmentation.py`：
```python
import torch
import torch.nn as nn
from torch.utils.data import DataLoader
from mobilenet_unet import MobileNetUNet
from dataset import CellSegmentationDataset

# 设备
device = 'cuda' if torch.cuda.is_available() else 'cpu'

# 模型
model = MobileNetUNet(num_classes=2).to(device)

# 数据
train_dataset = CellSegmentationDataset('data/train/images', 'data/train/masks')
train_loader = DataLoader(train_dataset, batch_size=4, shuffle=True)

# 损失函数和优化器
criterion = nn.CrossEntropyLoss()
optimizer = torch.optim.Adam(model.parameters(), lr=1e-4)

# 训练循环
num_epochs = 50
for epoch in range(num_epochs):
    model.train()
    total_loss = 0

    for images, masks in train_loader:
        images = images.to(device)
        masks = masks.to(device)

        # 前向传播
        outputs = model(images)
        loss = criterion(outputs, masks)

        # 反向传播
        optimizer.zero_grad()
        loss.backward()
        optimizer.step()

        total_loss += loss.item()

    print(f"Epoch {epoch+1}/{num_epochs}, Loss: {total_loss/len(train_loader):.4f}")

    # 每10轮保存一次
    if (epoch + 1) % 10 == 0:
        torch.save(model.state_dict(), f'models/mobilenet/checkpoint_epoch_{epoch+1}.pth')

# 保存最终模型
torch.save(model.state_dict(), 'models/mobilenet/cell_segmentation_final.pth')
```

**注意：你需要训练两个分割模型！**

1. **细胞分割模型**：分割整个细胞
2. **细胞核分割模型**：分割细胞核（用于计算核质比）

```bash
# 训练细胞分割
python src/segmentation/train_segmentation.py --target cell

# 训练细胞核分割
python src/segmentation/train_segmentation.py --target nucleus
```

**输出：✅ 训练好的分割模型**

```
models/mobilenet/
├─ cell_segmentation.pth
└─ nucleus_segmentation.pth
```

---

## 阶段5：定量分析模块开发

### 时间：2-3天

### 需要做什么：

这部分**不需要训练**，是纯代码实现！

创建 `src/analysis/quantitative_analyzer.py`：
```python
import cv2
import numpy as np

class QuantitativeAnalyzer:
    """定量分析模块"""

    def __init__(self, pixel_to_micron_ratio=10):
        self.pixel_to_micron_ratio = pixel_to_micron_ratio

    def analyze_cell(self, cell_image, cell_mask, nucleus_mask):
        """分析单个细胞"""

        # 1. 物理尺寸测量
        size_metrics = self._measure_size(cell_mask)

        # 2. 核质比计算
        nc_ratio = self._calculate_nc_ratio(cell_mask, nucleus_mask)

        # 3. HSI颜色量化
        color_metrics = self._analyze_color(cell_image, cell_mask)

        # 4. 形态特征提取
        morphology_metrics = self._extract_morphology(cell_mask)

        return {
            **size_metrics,
            'nc_ratio': nc_ratio,
            **color_metrics,
            **morphology_metrics
        }

    def _measure_size(self, mask):
        """测量尺寸"""
        area_pixels = np.sum(mask)
        area_microns = area_pixels / (self.pixel_to_micron_ratio ** 2)
        diameter = 2 * np.sqrt(area_microns / np.pi)

        return {
            'area_pixels': area_pixels,
            'area_microns_sq': area_microns,
            'diameter_microns': diameter
        }

    def _calculate_nc_ratio(self, cell_mask, nucleus_mask):
        """计算核质比"""
        nucleus_area = np.sum(nucleus_mask)
        cell_area = np.sum(cell_mask)
        return nucleus_area / cell_area if cell_area > 0 else 0

    def _analyze_color(self, image, mask):
        """HSI颜色分析"""
        # 转HSV（接近HSI）
        hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
        cell_pixels = hsv[mask > 0]

        return {
            'h_mean': np.mean(cell_pixels[:, 0]),
            's_mean': np.mean(cell_pixels[:, 1]),
            'i_mean': np.mean(cell_pixels[:, 2]),
            'i_std': np.std(cell_pixels[:, 2])
        }

    def _extract_morphology(self, mask):
        """提取形态特征"""
        contours, _ = cv2.findContours(mask.astype(np.uint8),
                                        cv2.RETR_EXTERNAL,
                                        cv2.CHAIN_APPROX_SIMPLE)
        if len(contours) == 0:
            return {'circularity': 0, 'aspect_ratio': 1}

        area = cv2.contourArea(contours[0])
        perimeter = cv2.arcLength(contours[0], True)
        circularity = 4 * np.pi * area / (perimeter ** 2) if perimeter > 0 else 0

        return {
            'circularity': circularity,
            'perimeter': perimeter
        }
```

**输出：✅ 定量分析代码**

---

## 阶段6：癌细胞检测模块开发

### 时间：3-5天

### 需要做什么：

#### 6.1 特征分类器训练

创建 `src/analysis/cancer_detector.py`：
```python
from sklearn.ensemble import RandomForestClassifier
import joblib

class CancerCellDetector:
    """癌细胞检测器（需要训练）"""

    def __init__(self):
        self.classifier = RandomForestClassifier(n_estimators=100)

    def train(self, training_data):
        """
        training_data: list of (features_dict, label)
        label: 0=正常, 1=可疑, 2=癌细胞
        """
        X = []
        y = []

        for features, label in training_data:
            # 提取特征向量
            feature_vector = [
                features['diameter_microns'],
                features['nc_ratio'],
                features['h_mean'],
                features['i_mean'],
                features['circularity']
            ]
            X.append(feature_vector)
            y.append(label)

        self.classifier.fit(X, y)

        # 保存模型
        joblib.dump(self.classifier, 'models/classifiers/cancer_detector.pkl')

    def predict(self, features):
        """预测"""
        feature_vector = [
            features['diameter_microns'],
            features['nc_ratio'],
            features['h_mean'],
            features['i_mean'],
            features['circularity']
        ]

        label = self.classifier.predict([feature_vector])[0]
        proba = self.classifier.predict_proba([feature_vector])[0]

        return {
            'label': label,
            'confidence': proba[label]
        }
```

**这个模块需要标注数据训练！**

**输出：✅ 癌细胞检测器**

---

## 阶段7：指标计算模块

### 时间：1-2天

这部分是纯数学公式，不需要训练！

创建 `src/analysis/metrics_calculator.py`：
```python
class MetricsCalculator:
    """计算H-Score、IRS等指标"""

    def calculate_all_metrics(self, cells_analysis):
        """
        cells_analysis: list of cell analysis results
        """
        # 统计各等级细胞
        total_cells = len(cells_analysis)
        weak = sum(1 for c in cells_analysis if c['positivity'] == 1)
        moderate = sum(1 for c in cells_analysis if c['positivity'] == 2)
        strong = sum(1 for c in cells_analysis if c['positivity'] == 3)

        # H-Score公式
        h_score = (weak/total_cells*100*1 +
                   moderate/total_cells*100*2 +
                   strong/total_cells*100*3)

        # IRS公式
        # ... (参考之前的代码)

        return {
            'h_score': h_score,
            'irs': irs,
            # ...
        }
```

**输出：✅ 指标计算代码**

---

## 阶段8-10：VL-LLM和Agent集成

这部分相对简单，主要是调用API和整合。

（详细步骤省略，重点是前面的训练部分）

---

## 总结：你具体需要做什么？

### 必须训练的模型（需要标注数据）：

1. ✅ **YOLO细胞检测器** - 需要框标注
2. ✅ **MobileNet细胞分割** - 需要mask标注
3. ✅ **MobileNet细胞核分割** - 需要mask标注
4. ✅ **癌细胞分类器** - 需要细胞级别标签

### 不需要训练的模块（纯代码）：

1. ❌ HSI颜色分析 - 规则或简单分类器
2. ❌ 几何测量 - 数学公式
3. ❌ H-Score/IRS计算 - 数学公式
4. ❌ VL-LLM - 使用预训练模型
5. ❌ Qwen-Agent - 使用预训练模型

### 最小工作量方案（快速验证）：

```
1. 标注50-100张图像（每张20-50个细胞）
2. 训练YOLO和MobileNet（各1-2天）
3. 用规则方法做颜色分类（不训练）
4. 集成VL-LLM和Qwen（1-2天）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
总计：1-2周完成MVP
```

### 生产级方案（高精度）：

```
1. 标注500-1000张图像
2. 精细训练所有模型（1-2周）
3. 训练癌细胞检测器
4. 完整测试和优化
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
总计：1-2个月完成完整系统
```

---

## 关键认知

**YOLO和MobileNet的预训练模型：**
- ✅ 提供了好的网络架构
- ✅ 提供了通用特征提取能力
- ❌ 不能直接用于病理图像
- ✅ 需要在你的数据上微调（fine-tune）

**这就是迁移学习（Transfer Learning）！**
