"""
备用方案：使用OpenCV传统方法进行细胞检测
如果Cellpose/StarDist安装失败，可以用这个快速看效果
"""
import cv2
import numpy as np
import matplotlib.pyplot as plt
import matplotlib
matplotlib.use('Agg')
from pathlib import Path
import os

ORIGINAL_DIR = "/home/proview/Desktop/Coder/cancerapp/ai/demo/processed/original"
ANNOTATED_DIR = "/home/proview/Desktop/Coder/cancerapp/ai/demo/processed/annotated"
OUTPUT_DIR = "/home/proview/Desktop/Coder/cancerapp/ai/demo/results_opencv"

os.makedirs(OUTPUT_DIR, exist_ok=True)

def simple_cell_detection(image_path):
    """使用OpenCV进行简单的细胞检测"""
    # 读取图像
    image = cv2.imread(image_path)
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

    # 高斯模糊
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)

    # 自适应阈值
    thresh = cv2.adaptiveThreshold(blurred, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
                                   cv2.THRESH_BINARY_INV, 11, 2)

    # 形态学操作
    kernel = np.ones((3, 3), np.uint8)
    morphed = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel, iterations=2)

    # 查找轮廓
    contours, _ = cv2.findContours(morphed, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    # 过滤小轮廓
    min_area = 20
    max_area = 500
    filtered_contours = [cnt for cnt in contours
                        if min_area < cv2.contourArea(cnt) < max_area]

    return filtered_contours, len(filtered_contours)

def create_comparison(image_name, original_path, annotated_path, output_path):
    """创建对比图"""
    # 读取图像
    original = cv2.imread(original_path)
    original_rgb = cv2.cvtColor(original, cv2.COLOR_BGR2RGB)
    annotated = cv2.imread(annotated_path)
    annotated_rgb = cv2.cvtColor(annotated, cv2.COLOR_BGR2RGB)

    # OpenCV检测
    contours, count = simple_cell_detection(original_path)

    # 绘制检测结果
    detection_result = original.copy()
    cv2.drawContours(detection_result, contours, -1, (0, 255, 0), 2)
    detection_rgb = cv2.cvtColor(detection_result, cv2.COLOR_BGR2RGB)

    # 创建对比图
    fig, axes = plt.subplots(1, 3, figsize=(18, 6))
    fig.suptitle(f'{image_name} - OpenCV简单检测', fontsize=16, fontweight='bold')

    axes[0].imshow(original_rgb)
    axes[0].set_title('原始图像', fontsize=14)
    axes[0].axis('off')

    axes[1].imshow(annotated_rgb)
    axes[1].set_title('原始系统标注', fontsize=14)
    axes[1].axis('off')

    axes[2].imshow(detection_rgb)
    axes[2].set_title(f'OpenCV检测\n检测到 {count} 个对象', fontsize=14, color='green')
    axes[2].axis('off')

    plt.tight_layout()
    plt.savefig(output_path, dpi=150, bbox_inches='tight')
    plt.close()

    return count

def main():
    original_images = sorted(Path(ORIGINAL_DIR).glob("*.jpg"))[:5]  # 测试5张

    print(f"OpenCV简单检测测试 (共{len(original_images)}张)")
    print("="*60)

    for i, original_path in enumerate(original_images, 1):
        image_name = original_path.stem
        annotated_path = Path(ANNOTATED_DIR) / original_path.name
        output_path = os.path.join(OUTPUT_DIR, f"{image_name}_opencv.jpg")

        print(f"[{i}/{len(original_images)}] {image_name}...", end=" ")

        count = create_comparison(image_name, str(original_path),
                                 str(annotated_path), output_path)

        print(f"✅ 检测到 {count} 个对象")

    print("="*60)
    print(f"完成！结果保存在: {OUTPUT_DIR}")

if __name__ == "__main__":
    main()
