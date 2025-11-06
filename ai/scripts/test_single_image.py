"""
测试单张图片 - 用于调试

改进：
- 自动从 ai/demo/processed/original 选择第一张可用图片
- 支持通过环境变量 IMAGE_PATH 指定图片绝对或相对路径
"""
import os
from pathlib import Path
import cv2
import numpy as np
import matplotlib.pyplot as plt
import matplotlib
matplotlib.use('Agg')

# 自动解析默认路径（相对 ai/ 根目录）
AI_DIR = Path(__file__).resolve().parents[1]
ORIGINAL_DIR = AI_DIR / "demo" / "processed" / "original"
DEFAULT_IMAGE = next(iter(sorted(ORIGINAL_DIR.glob("*.jpg"))), None)

# 允许通过环境变量覆盖输入
IMAGE_PATH = os.environ.get("IMAGE_PATH", str(DEFAULT_IMAGE) if DEFAULT_IMAGE else "")
OUTPUT_PATH = str(AI_DIR / "demo" / "test_single.jpg")

print("=" * 60)
print("开始测试单张图片...")
print("=" * 60)

# 读取图像
print("\n1. 读取图像...")
if not IMAGE_PATH:
    print("❌ 未找到测试图片，请先运行 split 脚本生成原始图像，或设置环境变量 IMAGE_PATH 指定图片路径")
    exit(1)

image = cv2.imread(IMAGE_PATH)
if image is None:
    print(f"❌ 无法读取图像: {IMAGE_PATH}")
    exit(1)
image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
print(f"✓ 使用图片: {IMAGE_PATH}")
print(f"✓ 图像尺寸: {image.shape}")

# 测试Cellpose
print("\n2. 测试Cellpose...")
try:
    from cellpose import models
    print("  ✓ Cellpose库导入成功")

    print("  - 加载模型...")
    model = models.CellposeModel(gpu=False, model_type='cyto3')
    print("  ✓ 模型加载成功")

    print("  - 运行分割...")
    masks, flows, styles = model.eval(
        image_rgb,
        diameter=30,  # IHC细胞直径约30像素
        flow_threshold=0.4,
        cellprob_threshold=-2.0,  # 降低阈值以检测更多细胞
        min_size=15  # 最小细胞尺寸
    )
    cell_count = len(np.unique(masks)) - 1
    print(f"  ✓ Cellpose完成！检测到 {cell_count} 个细胞")
    cellpose_masks = masks

except Exception as e:
    print(f"  ❌ Cellpose错误: {e}")
    import traceback
    traceback.print_exc()
    cellpose_masks = None
    cell_count = 0

# 测试StarDist
print("\n3. 测试StarDist...")
try:
    from stardist.models import StarDist2D
    print("  ✓ StarDist库导入成功")

    print("  - 加载模型...")
    model = StarDist2D.from_pretrained('2D_versatile_he')
    print("  ✓ 模型加载成功")

    print("  - 运行检测...")
    labels, details = model.predict_instances(
        image_rgb,
        prob_thresh=0.3,  # 降低概率阈值
        nms_thresh=0.3    # NMS阈值
    )
    nucleus_count = labels.max()
    print(f"  ✓ StarDist完成！检测到 {nucleus_count} 个细胞核")
    stardist_labels = labels

except Exception as e:
    print(f"  ❌ StarDist错误: {e}")
    import traceback
    traceback.print_exc()
    stardist_labels = None
    nucleus_count = 0

# 生成可视化
print("\n4. 生成可视化结果...")
fig, axes = plt.subplots(1, 3, figsize=(18, 6))

# 原图
axes[0].imshow(image_rgb)
axes[0].set_title('Original Image', fontsize=14)
axes[0].axis('off')

# Cellpose结果
if cellpose_masks is not None:
    from skimage.segmentation import find_boundaries
    cellpose_overlay = image_rgb.copy()
    boundaries = find_boundaries(cellpose_masks, mode='outer')
    cellpose_overlay[boundaries] = [0, 255, 0]
    axes[1].imshow(cellpose_overlay)
    axes[1].set_title(f'Cellpose: {cell_count} cells', fontsize=14, color='green')
else:
    axes[1].text(0.5, 0.5, 'Cellpose Failed', ha='center', va='center', fontsize=16, color='red')
    axes[1].set_title('Cellpose Result', fontsize=14)
axes[1].axis('off')

# StarDist结果
if stardist_labels is not None:
    from skimage.segmentation import find_boundaries
    stardist_overlay = image_rgb.copy()
    boundaries = find_boundaries(stardist_labels, mode='outer')
    stardist_overlay[boundaries] = [255, 0, 0]
    axes[2].imshow(stardist_overlay)
    axes[2].set_title(f'StarDist: {nucleus_count} nuclei', fontsize=14, color='red')
else:
    axes[2].text(0.5, 0.5, 'StarDist Failed', ha='center', va='center', fontsize=16, color='red')
    axes[2].set_title('StarDist Result', fontsize=14)
axes[2].axis('off')

plt.tight_layout()
plt.savefig(OUTPUT_PATH, dpi=150, bbox_inches='tight')
print(f"✓ 结果保存到: {OUTPUT_PATH}")

print("\n" + "=" * 60)
print("测试完成！")
print("=" * 60)
