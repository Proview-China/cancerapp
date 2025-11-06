"""
完整的病理图像定量分析Pipeline示例
展示如何从图像到专业指标
"""

import cv2
import numpy as np
from typing import List, Dict, Tuple


class PathologyQuantitativeAnalyzer:
    """病理图像定量分析器"""

    def __init__(self, yolo_model, segmentation_model, pixel_to_mm_ratio=350):
        """
        Args:
            yolo_model: YOLO细胞检测模型
            segmentation_model: MobileNet分割模型
            pixel_to_mm_ratio: 像素到毫米的转换比例（取决于放大倍数）
        """
        self.yolo_model = yolo_model
        self.segmentation_model = segmentation_model
        self.pixel_to_mm_ratio = pixel_to_mm_ratio

    def analyze(self, image_path: str) -> Dict:
        """
        完整分析流程

        Returns:
            包含所有定量指标的字典
        """
        # 加载图像
        image = cv2.imread(image_path)

        # Step 1: YOLO检测细胞
        print("Step 1: 检测细胞...")
        cells = self._detect_cells(image)
        print(f"  检测到 {len(cells)} 个细胞")

        # Step 2: MobileNet精确分割
        print("Step 2: 精确分割细胞...")
        cell_masks = self._segment_cells(image, cells)

        # Step 3: 颜色分析（阳性等级分类）⭐关键步骤⭐
        print("Step 3: 颜色分析和阳性分类...")
        cell_data = self._classify_cells(image, cell_masks)

        # Step 4: 计算IOD
        print("Step 4: 计算光密度...")
        total_iod = self._calculate_total_iod(image, cell_data)

        # Step 5: 计算面积
        print("Step 5: 计算面积...")
        areas = self._calculate_areas(cell_data)

        # Step 6: 计算专业指标
        print("Step 6: 计算病理学指标...")
        metrics = self._calculate_metrics(cell_data, areas, total_iod)

        return metrics

    def _detect_cells(self, image: np.ndarray) -> List[Dict]:
        """
        Step 1: 使用YOLO检测所有细胞

        这里YOLO只做一件事：找到细胞的位置
        """
        # 实际使用：
        # results = self.yolo_model.predict(image)
        # cells = [{'bbox': box.xywh, 'conf': box.conf} for box in results[0].boxes]

        # 演示用模拟数据
        cells = [
            {'bbox': [100, 200, 30, 30], 'confidence': 0.95},
            {'bbox': [150, 220, 28, 32], 'confidence': 0.92},
            # ... 实际会有数千个
        ]
        return cells

    def _segment_cells(self, image: np.ndarray, cells: List[Dict]) -> List[Dict]:
        """
        Step 2: 使用MobileNet对每个细胞进行精确分割

        MobileNet做两件事：
        1. 得到细胞的精确轮廓（mask）
        2. 计算细胞面积（像素数）
        """
        cell_masks = []

        for cell in cells:
            x, y, w, h = cell['bbox']

            # 裁剪细胞区域
            cell_crop = image[int(y):int(y+h), int(x):int(x+w)]

            # 实际使用：
            # mask = self.segmentation_model.predict(cell_crop)

            # 演示用模拟mask
            mask = np.random.rand(int(h), int(w)) > 0.3

            cell_masks.append({
                'bbox': cell['bbox'],
                'mask': mask,
                'area_pixels': np.sum(mask)
            })

        return cell_masks

    def _classify_cells(self, image: np.ndarray, cell_masks: List[Dict]) -> List[Dict]:
        """
        Step 3: HSI颜色分析，分类阳性等级

        ⭐这是最关键的一步⭐
        将每个细胞分类为：阴性(0)/弱阳性(1)/中度(2)/强阳性(3)
        """
        cell_data = []

        for cell in cell_masks:
            x, y, w, h = cell['bbox']

            # 提取细胞区域
            cell_region = image[int(y):int(y+h), int(x):int(x+w)]

            # 颜色分析
            grade, label = self._classify_cell_positivity(cell_region, cell['mask'])

            cell_data.append({
                **cell,
                'grade': grade,
                'label': label
            })

        return cell_data

    def _classify_cell_positivity(
        self,
        cell_image: np.ndarray,
        cell_mask: np.ndarray
    ) -> Tuple[int, str]:
        """
        根据HSI颜色判断阳性等级

        免疫组化染色：
        - DAB染色（棕色）= 阳性信号
        - 苏木素染色（蓝紫色）= 细胞核背景

        颜色标准（文档）：
        - 阴性: 无DAB着色（只有蓝紫色）
        - 弱阳性(1分): 淡黄色
        - 中度阳性(2分): 棕黄色
        - 强阳性(3分): 棕褐色（深棕色）
        """
        # 转换到HSV颜色空间（接近HSI）
        hsv = cv2.cvtColor(cell_image, cv2.COLOR_BGR2HSV)

        # 只分析细胞区域的像素
        cell_pixels_hsv = hsv[cell_mask > 0]

        if len(cell_pixels_hsv) == 0:
            return 0, 'negative'

        # 计算平均HSV值
        avg_h = np.mean(cell_pixels_hsv[:, 0])  # 色调 Hue
        avg_s = np.mean(cell_pixels_hsv[:, 1])  # 饱和度 Saturation
        avg_v = np.mean(cell_pixels_hsv[:, 2])  # 明度 Value

        # 判断是否为棕色系（DAB染色）
        # DAB的HSV范围（这些阈值需要根据实际图像标定）：
        # H: 10-30 (黄色到橙棕色)
        # S: 50-255 (有饱和度，不是灰色)
        # V: 50-200 (中等亮度)

        is_brown = (10 <= avg_h <= 30) and (avg_s >= 50) and (50 <= avg_v <= 200)

        if not is_brown:
            # 蓝紫色（苏木素）或其他颜色 → 阴性
            return 0, 'negative'

        # 是棕色系，根据明度V判断强度
        if avg_v < 100:
            # 深棕色 → 强阳性
            return 3, 'strong_positive'
        elif avg_v < 150:
            # 中等棕色 → 中度阳性
            return 2, 'moderate_positive'
        else:
            # 淡棕/黄色 → 弱阳性
            return 1, 'weak_positive'

    def _calculate_total_iod(
        self,
        image: np.ndarray,
        cell_data: List[Dict]
    ) -> float:
        """
        Step 4: 计算总IOD（累积光密度）

        IOD = Integrated Optical Density
        反映染色的总强度
        """
        total_iod = 0

        # 转为灰度
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

        for cell in cell_data:
            if cell['grade'] == 0:
                # 阴性细胞不计入IOD
                continue

            x, y, w, h = cell['bbox']
            mask = cell['mask']

            # 提取细胞区域
            cell_gray = gray[int(y):int(y+h), int(x):int(x+w)]

            # 计算光密度
            # OD = -log10(透射率) ≈ 255 - 像素值
            cell_pixels = cell_gray[mask > 0]
            optical_density = 255 - cell_pixels
            cell_iod = np.sum(optical_density)

            total_iod += cell_iod

        return total_iod

    def _calculate_areas(self, cell_data: List[Dict]) -> Dict:
        """
        Step 5: 计算面积

        包括：
        - 组织总面积（所有细胞）
        - 阳性细胞面积
        - 像素面积 → mm²转换
        """
        # 组织总面积（像素）
        total_pixels = sum(cell['area_pixels'] for cell in cell_data)

        # 阳性细胞总面积（像素）
        positive_pixels = sum(
            cell['area_pixels']
            for cell in cell_data
            if cell['grade'] > 0
        )

        # 转换为mm²
        # 公式：面积(mm²) = 面积(像素) / (像素/mm)²
        total_mm2 = total_pixels / (self.pixel_to_mm_ratio ** 2)
        positive_mm2 = positive_pixels / (self.pixel_to_mm_ratio ** 2)

        return {
            'tissue_area_pixels': total_pixels,
            'tissue_area_mm2': total_mm2,
            'positive_area_pixels': positive_pixels,
            'positive_area_mm2': positive_mm2
        }

    def _calculate_metrics(
        self,
        cell_data: List[Dict],
        areas: Dict,
        total_iod: float
    ) -> Dict:
        """
        Step 6: 计算所有病理学专业指标

        这一步完全是数学公式，不需要AI模型
        """
        # 统计各等级细胞数量
        total_cells = len(cell_data)
        negative_count = sum(1 for c in cell_data if c['grade'] == 0)
        weak_count = sum(1 for c in cell_data if c['grade'] == 1)
        moderate_count = sum(1 for c in cell_data if c['grade'] == 2)
        strong_count = sum(1 for c in cell_data if c['grade'] == 3)
        positive_count = weak_count + moderate_count + strong_count

        # 1. 阳性细胞比率 (%)
        positive_ratio = (positive_count / total_cells) * 100 if total_cells > 0 else 0

        # 2. H-Score（文档公式）
        # H-Score = (弱阳性% × 1) + (中度阳性% × 2) + (强阳性% × 3)
        weak_percent = (weak_count / total_cells) * 100 if total_cells > 0 else 0
        moderate_percent = (moderate_count / total_cells) * 100 if total_cells > 0 else 0
        strong_percent = (strong_count / total_cells) * 100 if total_cells > 0 else 0

        h_score = (weak_percent * 1) + (moderate_percent * 2) + (strong_percent * 3)

        # 3. IRS = SI × PP（文档公式）
        # SI: 阳性强度等级 (0-3)
        if strong_count > moderate_count and strong_count > weak_count:
            SI = 3
        elif moderate_count > weak_count:
            SI = 2
        elif weak_count > 0:
            SI = 1
        else:
            SI = 0

        # PP: 阳性细胞比率等级 (0-4)
        if positive_ratio > 75:
            PP = 4
        elif positive_ratio > 50:
            PP = 3
        elif positive_ratio > 25:
            PP = 2
        elif positive_ratio > 5:
            PP = 1
        else:
            PP = 0

        irs = SI * PP

        # 4. 阳性细胞密度 (cells/mm²)
        positive_density = positive_count / areas['tissue_area_mm2'] if areas['tissue_area_mm2'] > 0 else 0

        # 5. 平均光密度
        mean_density = total_iod / areas['positive_area_pixels'] if areas['positive_area_pixels'] > 0 else 0
        # 归一化到0-1范围
        mean_density = mean_density / 100000

        # 返回完整指标（对照文档格式）
        return {
            # 原始数据
            'total_cells': total_cells,
            'weak_positive_cells': weak_count,
            'moderate_positive_cells': moderate_count,
            'strong_positive_cells': strong_count,

            # 面积数据
            'tissue_area_mm2': round(areas['tissue_area_mm2'], 4),
            'tissue_area_pixels': areas['tissue_area_pixels'],
            'positive_area_mm2': round(areas['positive_area_mm2'], 4),
            'positive_area_pixels': areas['positive_area_pixels'],

            # 计算指标
            'positive_ratio': round(positive_ratio, 2),  # %
            'positive_density': round(positive_density, 0),  # cells/mm²
            'h_score': round(h_score, 2),  # 0-300
            'irs': irs,  # 0-12
            'mean_density': round(mean_density, 4),
            'iod': round(total_iod, 0),

            # 辅助信息
            'si': SI,
            'pp': PP
        }


# ===== 使用示例 =====

def main():
    """演示完整流程"""

    # 初始化分析器
    # yolo_model = YOLO('yolov8n.pt')  # 实际使用
    # seg_model = MobileNetUNet()      # 实际使用
    yolo_model = None  # 演示用
    seg_model = None   # 演示用

    analyzer = PathologyQuantitativeAnalyzer(
        yolo_model=yolo_model,
        segmentation_model=seg_model,
        pixel_to_mm_ratio=350  # 40x放大倍数
    )

    # 分析图像
    image_path = "path/to/tissue_slice.jpg"

    # 注意：这是演示代码，实际运行会报错
    # metrics = analyzer.analyze(image_path)

    # 模拟输出结果（对照文档第一行数据）
    metrics = {
        'total_cells': 12820,
        'weak_positive_cells': 8,
        'moderate_positive_cells': 11075,
        'strong_positive_cells': 888,
        'tissue_area_mm2': 2.3378,
        'tissue_area_pixels': 7733212,
        'positive_area_mm2': 0.8714,
        'positive_area_pixels': 2882594,
        'positive_ratio': 93.38,  # %
        'positive_density': 5121,  # cells/mm²
        'h_score': 193.62,
        'irs': 8,
        'mean_density': 0.0982,
        'iod': 282988,
        'si': 2,  # 中度阳性为主
        'pp': 4   # >75%
    }

    # 打印结果
    print("\n" + "="*50)
    print("病理图像定量分析结果")
    print("="*50)
    print(f"细胞总数: {metrics['total_cells']}")
    print(f"  - 弱阳性(1级): {metrics['weak_positive_cells']}")
    print(f"  - 中度阳性(2级): {metrics['moderate_positive_cells']}")
    print(f"  - 强阳性(3级): {metrics['strong_positive_cells']}")
    print(f"\n组织面积: {metrics['tissue_area_mm2']} mm²")
    print(f"阳性面积: {metrics['positive_area_mm2']} mm²")
    print(f"\n阳性细胞比率: {metrics['positive_ratio']}%")
    print(f"阳性细胞密度: {metrics['positive_density']} cells/mm²")
    print(f"\nH-Score: {metrics['h_score']} (0-300)")
    print(f"IRS: {metrics['irs']} (SI={metrics['si']} × PP={metrics['pp']})")
    print(f"IOD: {metrics['iod']}")
    print(f"平均光密度: {metrics['mean_density']}")
    print("="*50)

    # 这些数据会传给VL-LLM和Qwen-Agent进行综合分析
    return metrics


if __name__ == '__main__':
    main()


"""
关键理解：

1. YOLO的作用：
   - 找到细胞位置（bbox）
   - 计数（total_cells）

2. MobileNet的作用：
   - 精确分割（mask）
   - 计算面积（area_pixels）

3. HSI颜色分析的作用（最关键！）：
   - 分类阳性等级（grade: 0/1/2/3）
   - 这是连接"图像"和"指标"的桥梁

4. 数学公式的作用：
   - 根据分类结果计算H-Score、IRS等
   - 纯Python代码，不需要AI

完整流程：
检测 → 分割 → 颜色分类 → 公式计算 → 专业指标
"""
