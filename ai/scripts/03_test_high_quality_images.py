"""
测试高质量图片集 - 生成四宫格对比
"""
import cv2
import numpy as np
import matplotlib.pyplot as plt
import matplotlib
matplotlib.use('Agg')
from pathlib import Path
import os

# 配置路径
ORIGINAL_DIR = "/home/proview/Desktop/Coder/cancerapp/ai/demo/processed/original"
ANNOTATED_DIR = "/home/proview/Desktop/Coder/cancerapp/ai/demo/processed/annotated"
OUTPUT_DIR = "/home/proview/Desktop/Coder/cancerapp/ai/demo/results"

os.makedirs(OUTPUT_DIR, exist_ok=True)

def test_cellpose(image_path):
    """测试Cellpose细胞分割"""
    try:
        from cellpose import models

        image = cv2.imread(image_path)
        image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)

        print("  加载Cellpose模型...")
        model = models.CellposeModel(gpu=False, model_type='cyto3')

        print("  运行Cellpose分割...")
        masks, flows, styles = model.eval(
            image_rgb,
            diameter=30,
            flow_threshold=0.4,
            cellprob_threshold=-2.0,
            min_size=15
        )

        return masks, len(np.unique(masks)) - 1

    except Exception as e:
        print(f"  Cellpose错误: {e}")
        return None, 0

def test_stardist(image_path):
    """测试StarDist细胞核检测"""
    try:
        from stardist.models import StarDist2D

        image = cv2.imread(image_path)
        image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)

        print("  加载StarDist模型...")
        model = StarDist2D.from_pretrained('2D_versatile_he')

        print("  运行StarDist检测...")
        labels, details = model.predict_instances(
            image_rgb,
            prob_thresh=0.3,
            nms_thresh=0.3
        )

        return labels, labels.max()

    except Exception as e:
        print(f"  StarDist错误: {e}")
        return None, 0

def create_comparison_plot(image_name, original, annotated, cellpose_mask, stardist_mask,
                           cellpose_count, stardist_count, output_path):
    """创建4图对比"""

    fig, axes = plt.subplots(2, 2, figsize=(16, 16))
    fig.suptitle(f'{image_name} - Detection Comparison', fontsize=16, fontweight='bold')

    # 1. 原始图像
    axes[0, 0].imshow(original)
    axes[0, 0].set_title('Original IHC Image', fontsize=14)
    axes[0, 0].axis('off')

    # 2. 原始系统标注
    axes[0, 1].imshow(annotated)
    axes[0, 1].set_title('Original Annotation\n(Blue=Negative, Red=Positive)', fontsize=14)
    axes[0, 1].axis('off')

    # 3. Cellpose分割结果
    if cellpose_mask is not None and cellpose_count > 0:
        from skimage.segmentation import find_boundaries
        cellpose_overlay = original.copy()
        boundaries = find_boundaries(cellpose_mask, mode='outer')
        cellpose_overlay[boundaries] = [0, 255, 0]
        axes[1, 0].imshow(cellpose_overlay)
        axes[1, 0].set_title(f'Cellpose Cell Segmentation\n{cellpose_count} cells detected',
                            fontsize=14, color='green')
    else:
        axes[1, 0].text(0.5, 0.5, 'Cellpose: No cells detected',
                       ha='center', va='center', fontsize=12, color='orange')
        axes[1, 0].set_title('Cellpose Result', fontsize=14)
    axes[1, 0].axis('off')

    # 4. StarDist检测结果
    if stardist_mask is not None and stardist_count > 0:
        from skimage.segmentation import find_boundaries
        stardist_overlay = original.copy()
        boundaries = find_boundaries(stardist_mask, mode='outer')
        stardist_overlay[boundaries] = [255, 0, 0]
        axes[1, 1].imshow(stardist_overlay)
        axes[1, 1].set_title(f'StarDist Nucleus Detection\n{stardist_count} nuclei detected',
                            fontsize=14, color='red')
    else:
        axes[1, 1].text(0.5, 0.5, 'StarDist: No nuclei detected',
                       ha='center', va='center', fontsize=12, color='orange')
        axes[1, 1].set_title('StarDist Result', fontsize=14)
    axes[1, 1].axis('off')

    plt.tight_layout()
    plt.savefig(output_path, dpi=150, bbox_inches='tight')
    plt.close()

    print(f"  保存对比图到: {output_path}")

def main():
    # 获取所有图像
    original_images = sorted(Path(ORIGINAL_DIR).glob("*.jpg"))

    print(f"找到 {len(original_images)} 张测试图像")

    # 只测试1张图像
    test_count = min(1, len(original_images))
    print(f"将测试 {test_count} 张图像\n")

    for i, original_path in enumerate(original_images[:test_count], 1):
        image_name = original_path.stem
        annotated_path = Path(ANNOTATED_DIR) / original_path.name

        print(f"[{i}/{test_count}] 处理 {image_name}...")

        # 读取图像
        original = cv2.imread(str(original_path))
        original_rgb = cv2.cvtColor(original, cv2.COLOR_BGR2RGB)

        annotated = cv2.imread(str(annotated_path))
        annotated_rgb = cv2.cvtColor(annotated, cv2.COLOR_BGR2RGB)

        # 测试Cellpose
        cellpose_mask, cellpose_count = test_cellpose(str(original_path))

        # 测试StarDist
        stardist_mask, stardist_count = test_stardist(str(original_path))

        # 生成对比图
        output_path = os.path.join(OUTPUT_DIR, f"{image_name}_comparison.jpg")
        create_comparison_plot(
            image_name,
            original_rgb,
            annotated_rgb,
            cellpose_mask,
            stardist_mask,
            cellpose_count,
            stardist_count,
            output_path
        )

        print(f"  ✅ 完成！Cellpose: {cellpose_count}个细胞, StarDist: {stardist_count}个细胞核\n")

    print(f"\n{'='*60}")
    print(f"测试完成！")
    print(f"对比图保存在: {OUTPUT_DIR}")
    print(f"{'='*60}")

if __name__ == "__main__":
    main()
