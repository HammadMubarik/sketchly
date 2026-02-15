"""
CNN Shape Recognizer - Training Script
Generates synthetic hand-drawn shape data, trains a CNN, and exports to TensorFlow.js format.

Usage:
    pip install -r requirements.txt
    python train_model.py
"""

import os
import math
import random
import numpy as np
import tensorflow as tf
from tensorflow import keras
from sklearn.model_selection import train_test_split
from sklearn.metrics import confusion_matrix, classification_report

# ─── Config ──────────────────────────────────────────────────────────────────

CANVAS_SIZE = 48
NUM_CLASSES = 10
SAMPLES_PER_CLASS = 4000
BATCH_SIZE = 32
MAX_EPOCHS = 100
STROKE_WIDTH = 1.5

SHAPE_NAMES = [
    "circle",
    "square",
    "rectangle",
    "triangle",
    "arrow-left",
    "arrow-right",
    "arrow-up",
    "arrow-down",
    "diamond",
    "line",
]

# Shapes that form closed loops
CLOSED_SHAPES = {"circle", "square", "rectangle", "triangle", "diamond"}

# Class-specific rotation ranges (degrees)
ROTATION_RANGES = {
    "circle": (-180, 180),
    "square": (-15, 15),      # keep sides roughly horizontal/vertical
    "rectangle": (-15, 15),
    "triangle": (-30, 30),
    "arrow-left": (-10, 10),
    "arrow-right": (-10, 10),
    "arrow-up": (-10, 10),
    "arrow-down": (-10, 10),
    "diamond": (-15, 15),     # keep vertices at cardinal points
    "line": (-180, 180),
}

EXPORT_PATH = os.path.join(
    os.path.dirname(__file__), "..", "frontend", "public", "models", "shape-recognizer"
)


# ─── Geometry helpers ────────────────────────────────────────────────────────


def lerp_points(p1, p2, n):
    """Linearly interpolate n points between p1 and p2."""
    pts = []
    for i in range(n):
        t = i / max(n - 1, 1)
        pts.append((p1[0] + t * (p2[0] - p1[0]), p1[1] + t * (p2[1] - p1[1])))
    return pts


def path_length(points):
    """Total euclidean path length."""
    total = 0
    for i in range(1, len(points)):
        dx = points[i][0] - points[i - 1][0]
        dy = points[i][1] - points[i - 1][1]
        total += math.sqrt(dx * dx + dy * dy)
    return total


def interpolate_along_edges(vertices, total_points):
    """Distribute points evenly along polygon edges."""
    edges = []
    for i in range(len(vertices) - 1):
        edges.append((vertices[i], vertices[i + 1]))

    edge_lengths = []
    for a, b in edges:
        edge_lengths.append(math.sqrt((b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2))

    total_len = sum(edge_lengths)
    if total_len == 0:
        return [vertices[0]] * total_points

    points = []
    for (a, b), elen in zip(edges, edge_lengths):
        n = max(2, int(round(total_points * elen / total_len)))
        points.extend(lerp_points(a, b, n))

    return points[:total_points]


# ─── Hand-drawing simulation ────────────────────────────────────────────────


def add_hand_wobble(points, intensity=1.5):
    """Add realistic hand tremor using overlapping sine waves + noise."""
    n = len(points)
    if n < 2:
        return points

    result = []
    freq1 = random.uniform(0.05, 0.15)
    freq2 = random.uniform(0.2, 0.4)
    phase1 = random.uniform(0, 2 * math.pi)
    phase2 = random.uniform(0, 2 * math.pi)

    for i, (x, y) in enumerate(points):
        t = i / max(n - 1, 1)

        # Normal direction (perpendicular to stroke direction)
        if i == 0:
            dx = points[1][0] - points[0][0]
            dy = points[1][1] - points[0][1]
        elif i == n - 1:
            dx = points[-1][0] - points[-2][0]
            dy = points[-1][1] - points[-2][1]
        else:
            dx = points[i + 1][0] - points[i - 1][0]
            dy = points[i + 1][1] - points[i - 1][1]

        mag = math.sqrt(dx * dx + dy * dy) + 1e-8
        nx, ny = -dy / mag, dx / mag

        # Low-frequency drift + high-frequency tremor
        wobble = (
            math.sin(t * n * freq1 + phase1) * intensity * 0.6
            + math.sin(t * n * freq2 + phase2) * intensity * 0.3
            + random.gauss(0, intensity * 0.3)
        )

        result.append((x + nx * wobble, y + ny * wobble))

    return result


def simulate_incomplete_shape(points, is_closed):
    """Randomly remove the tail of closed shapes to simulate not fully closing."""
    if not is_closed:
        return points
    if random.random() > 0.4:  # 40% chance of incomplete
        return points

    ratio = random.uniform(0.80, 0.95)
    return points[: max(3, int(len(points) * ratio))]


def simulate_stroke_speed(points):
    """Vary point density: more points at high-curvature areas, fewer on straights."""
    if len(points) < 5:
        return points

    # Calculate curvature at each point
    curvatures = [0.0]
    for i in range(1, len(points) - 1):
        ax, ay = points[i - 1]
        bx, by = points[i]
        cx, cy = points[i + 1]

        v1x, v1y = bx - ax, by - ay
        v2x, v2y = cx - bx, cy - by

        cross = abs(v1x * v2y - v1y * v2x)
        dot = v1x * v2x + v1y * v2y
        angle = math.atan2(cross, dot + 1e-8)
        curvatures.append(angle)
    curvatures.append(0.0)

    # Resample: keep more points where curvature is high
    result = [points[0]]
    for i in range(1, len(points)):
        # Higher curvature = always keep; lower curvature = randomly skip
        keep_prob = 0.3 + 0.7 * min(curvatures[i] / 0.5, 1.0)
        if random.random() < keep_prob:
            result.append(points[i])

    if len(result) < 3:
        return points

    return result


def elastic_deform(points, alpha=4.0, sigma=3.0):
    """Apply smooth elastic deformation to simulate natural hand distortion."""
    if len(points) < 2:
        return points

    n = len(points)
    # Generate random displacement field
    dx_field = np.random.randn(n) * alpha
    dy_field = np.random.randn(n) * alpha

    # Smooth with gaussian kernel
    kernel_size = max(3, int(sigma * 2) | 1)
    kernel = np.exp(-0.5 * np.linspace(-2, 2, kernel_size) ** 2)
    kernel /= kernel.sum()

    dx_field = np.convolve(dx_field, kernel, mode="same")
    dy_field = np.convolve(dy_field, kernel, mode="same")

    result = []
    for i, (x, y) in enumerate(points):
        result.append((x + dx_field[i], y + dy_field[i]))

    return result


# ─── Shape generators ───────────────────────────────────────────────────────


def generate_circle():
    cx, cy = 50, 50
    base_r = 25 + random.random() * 15
    eccentricity = random.uniform(0.85, 1.15)
    num_points = random.randint(50, 80)
    start_angle = random.uniform(0, 2 * math.pi)

    points = []
    for i in range(num_points + 1):
        theta = start_angle + (i / num_points) * 2 * math.pi
        r = base_r * (1 + random.uniform(-0.08, 0.08))
        rx = r * eccentricity
        ry = r / eccentricity
        x = cx + rx * math.cos(theta)
        y = cy + ry * math.sin(theta)
        points.append((x, y))

    return points


def generate_square():
    size = 40 + random.random() * 25
    cx, cy = 50, 50
    half = size / 2

    # Slightly imperfect angles and side lengths
    skew = random.uniform(-0.08, 0.08)
    side_var = [random.uniform(0.9, 1.1) for _ in range(4)]

    corners = [
        (cx - half * side_var[0], cy - half * side_var[1]),
        (cx + half * side_var[0], cy - half * side_var[1] + skew * size),
        (cx + half * side_var[2] + skew * size, cy + half * side_var[3]),
        (cx - half * side_var[2], cy + half * side_var[3]),
        (cx - half * side_var[0], cy - half * side_var[1]),  # close
    ]

    num_points = random.randint(40, 70)
    return interpolate_along_edges(corners, num_points)


def generate_rectangle():
    w = 50 + random.random() * 30
    aspect = random.uniform(1.4, 2.8)
    h = w / aspect
    cx, cy = 50, 50

    skew = random.uniform(-0.06, 0.06)

    corners = [
        (cx - w / 2, cy - h / 2),
        (cx + w / 2, cy - h / 2 + skew * h),
        (cx + w / 2 + skew * w, cy + h / 2),
        (cx - w / 2, cy + h / 2),
        (cx - w / 2, cy - h / 2),  # close
    ]

    # Randomly orient horizontally or vertically
    if random.random() < 0.5:
        corners = [(y - 50 + 50, x - 50 + 50) for x, y in corners]

    num_points = random.randint(40, 70)
    return interpolate_along_edges(corners, num_points)


def generate_triangle():
    cx, cy = 50, 50
    base_r = 25 + random.random() * 15

    # Random triangle (not necessarily equilateral)
    angles = sorted([random.uniform(0, 2 * math.pi) for _ in range(3)])
    vertices = []
    for a in angles:
        r = base_r * random.uniform(0.8, 1.2)
        vertices.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    vertices.append(vertices[0])  # close

    num_points = random.randint(35, 60)
    return interpolate_along_edges(vertices, num_points)


def _generate_arrow(direction):
    length = 45 + random.random() * 25
    cx, cy = 50, 50
    head_size = 14 + random.random() * 10
    head_angle = math.pi / 6 + random.uniform(-0.15, 0.15)

    shaft_points = random.randint(20, 40)
    # Slight curvature in shaft
    curvature = random.uniform(-3, 3)

    if direction == "right":
        start = (cx - length / 2, cy)
        tip = (cx + length / 2, cy)
        shaft_dir = (1, 0)
    elif direction == "left":
        start = (cx + length / 2, cy)
        tip = (cx - length / 2, cy)
        shaft_dir = (-1, 0)
    elif direction == "up":
        start = (cx, cy + length / 2)
        tip = (cx, cy - length / 2)
        shaft_dir = (0, -1)
    else:  # down
        start = (cx, cy - length / 2)
        tip = (cx, cy + length / 2)
        shaft_dir = (0, 1)

    # Generate shaft with curvature
    points = []
    for i in range(shaft_points):
        t = i / (shaft_points - 1)
        x = start[0] + t * (tip[0] - start[0])
        y = start[1] + t * (tip[1] - start[1])
        # Add perpendicular curvature
        perp_x = -shaft_dir[1]
        perp_y = shaft_dir[0]
        curve_offset = curvature * math.sin(t * math.pi)
        x += perp_x * curve_offset
        y += perp_y * curve_offset
        points.append((x, y))

    # Arrowhead
    tx, ty = tip
    dx, dy = shaft_dir
    angle = math.atan2(dy, dx)

    wing1 = (
        tx - head_size * math.cos(angle - head_angle),
        ty - head_size * math.sin(angle - head_angle),
    )
    wing2 = (
        tx - head_size * math.cos(angle + head_angle),
        ty - head_size * math.sin(angle + head_angle),
    )

    points.append(wing1)
    points.append(tip)
    points.append(wing2)

    return points


def generate_arrow_left():
    return _generate_arrow("left")


def generate_arrow_right():
    return _generate_arrow("right")


def generate_arrow_up():
    return _generate_arrow("up")


def generate_arrow_down():
    return _generate_arrow("down")


def generate_diamond():
    size = 40 + random.random() * 25
    cx, cy = 50, 50

    # Make diamond more distinct: taller than wide (elongated vertically)
    h_stretch = random.uniform(1.1, 1.5)
    w_stretch = random.uniform(0.7, 1.0)
    axis_var = [random.uniform(0.93, 1.07) for _ in range(4)]

    corners = [
        (cx, cy - size / 2 * h_stretch * axis_var[0]),   # top (further up)
        (cx + size / 2 * w_stretch * axis_var[1], cy),    # right (narrower)
        (cx, cy + size / 2 * h_stretch * axis_var[2]),    # bottom (further down)
        (cx - size / 2 * w_stretch * axis_var[3], cy),    # left (narrower)
        (cx, cy - size / 2 * h_stretch * axis_var[0]),    # close
    ]

    num_points = random.randint(35, 60)
    return interpolate_along_edges(corners, num_points)


def generate_line():
    length = 45 + random.random() * 35
    cx, cy = 50, 50
    angle = random.uniform(0, math.pi)

    x1 = cx - (length / 2) * math.cos(angle)
    y1 = cy - (length / 2) * math.sin(angle)
    x2 = cx + (length / 2) * math.cos(angle)
    y2 = cy + (length / 2) * math.sin(angle)

    num_points = random.randint(20, 40)
    curvature = random.uniform(-2, 2)

    points = []
    for i in range(num_points):
        t = i / (num_points - 1)
        x = x1 + t * (x2 - x1)
        y = y1 + t * (y2 - y1)
        # Slight curvature
        perp_x = -(y2 - y1) / (length + 1e-8)
        perp_y = (x2 - x1) / (length + 1e-8)
        offset = curvature * math.sin(t * math.pi)
        x += perp_x * offset
        y += perp_y * offset
        points.append((x, y))

    return points


GENERATORS = {
    "circle": generate_circle,
    "square": generate_square,
    "rectangle": generate_rectangle,
    "triangle": generate_triangle,
    "arrow-left": generate_arrow_left,
    "arrow-right": generate_arrow_right,
    "arrow-up": generate_arrow_up,
    "arrow-down": generate_arrow_down,
    "diamond": generate_diamond,
    "line": generate_line,
}


# ─── Augmentation ────────────────────────────────────────────────────────────


def augment(points, shape_name):
    """Apply full augmentation pipeline."""

    is_closed = shape_name in CLOSED_SHAPES
    rot_min, rot_max = ROTATION_RANGES[shape_name]

    # 1. Hand wobble (variable intensity)
    intensity = random.uniform(0.5, 2.5)
    points = add_hand_wobble(points, intensity)

    # 2. Incomplete shape
    points = simulate_incomplete_shape(points, is_closed)

    # 3. Stroke speed variation
    if random.random() < 0.5:
        points = simulate_stroke_speed(points)

    # 4. Elastic deformation
    if random.random() < 0.6:
        alpha = random.uniform(2.0, 6.0)
        points = elastic_deform(points, alpha=alpha, sigma=3.0)

    # 5. Rotation
    angle_deg = random.uniform(rot_min, rot_max)
    points = rotate(points, math.radians(angle_deg))

    # 6. Scale
    scale_factor = random.uniform(0.6, 1.8)
    points = scale(points, scale_factor)

    # 7. Translation
    tx = random.uniform(-8, 8)
    ty = random.uniform(-8, 8)
    points = translate(points, tx, ty)

    # 8. Gaussian noise on each point
    noise_std = random.uniform(0.3, 1.5)
    points = add_noise(points, noise_std)

    return points


def rotate(points, angle):
    cx = sum(p[0] for p in points) / len(points)
    cy = sum(p[1] for p in points) / len(points)
    cos_a, sin_a = math.cos(angle), math.sin(angle)
    return [
        (cx + (x - cx) * cos_a - (y - cy) * sin_a, cy + (x - cx) * sin_a + (y - cy) * cos_a)
        for x, y in points
    ]


def scale(points, factor):
    cx = sum(p[0] for p in points) / len(points)
    cy = sum(p[1] for p in points) / len(points)
    return [(cx + (x - cx) * factor, cy + (y - cy) * factor) for x, y in points]


def translate(points, dx, dy):
    return [(x + dx, y + dy) for x, y in points]


def add_noise(points, std):
    return [(x + random.gauss(0, std), y + random.gauss(0, std)) for x, y in points]


# ─── Rasterization ──────────────────────────────────────────────────────────


def normalize_points(points, size):
    """Normalize points to fit in a size x size canvas with padding."""
    xs = [p[0] for p in points]
    ys = [p[1] for p in points]
    min_x, max_x = min(xs), max(xs)
    min_y, max_y = min(ys), max(ys)
    w = max_x - min_x
    h = max_y - min_y

    if w == 0 and h == 0:
        return [(size / 2, size / 2)]

    padding = size * 0.1
    s = (size - 2 * padding) / max(w, h, 1e-8)

    offset_x = (size - w * s) / 2
    offset_y = (size - h * s) / 2

    return [((x - min_x) * s + offset_x, (y - min_y) * s + offset_y) for x, y in points]


def rasterize(points, size, stroke_width=STROKE_WIDTH):
    """Rasterize a list of points to a size x size grayscale image."""
    img = np.zeros((size, size), dtype=np.float32)
    norm = normalize_points(points, size)

    for i in range(1, len(norm)):
        x1, y1 = norm[i - 1]
        x2, y2 = norm[i]
        dx, dy = x2 - x1, y2 - y1
        steps = max(int(math.sqrt(dx * dx + dy * dy) * 2), 1)

        for s in range(steps + 1):
            t = s / steps
            cx = x1 + t * dx
            cy = y1 + t * dy

            # Draw circle at each step for consistent width
            for wx in range(int(-stroke_width - 1), int(stroke_width + 2)):
                for wy in range(int(-stroke_width - 1), int(stroke_width + 2)):
                    dist = math.sqrt(wx * wx + wy * wy)
                    if dist <= stroke_width:
                        px = int(round(cx + wx))
                        py = int(round(cy + wy))
                        if 0 <= px < size and 0 <= py < size:
                            img[py, px] = 1.0

    return img


# ─── Dataset generation ─────────────────────────────────────────────────────


def generate_dataset():
    """Generate full training dataset."""
    images = []
    labels = []

    total = SAMPLES_PER_CLASS * NUM_CLASSES
    print(f"Generating {total} samples ({SAMPLES_PER_CLASS} per class, {NUM_CLASSES} classes)...")

    for class_idx, shape_name in enumerate(SHAPE_NAMES):
        print(f"  [{class_idx + 1}/{NUM_CLASSES}] {shape_name}...", end="", flush=True)
        gen_fn = GENERATORS[shape_name]

        for _ in range(SAMPLES_PER_CLASS):
            points = gen_fn()
            points = augment(points, shape_name)
            img = rasterize(points, CANVAS_SIZE)
            images.append(img)
            labels.append(class_idx)

        print(" done")

    images = np.array(images)[..., np.newaxis]  # (N, 48, 48, 1)
    labels = np.array(labels)

    print(f"Dataset: {images.shape[0]} images, shape {images.shape[1:]}")
    return images, labels


# ─── Model ───────────────────────────────────────────────────────────────────


def create_model():
    """Create the CNN model."""
    model = keras.Sequential(
        [
            # Block 1
            keras.layers.Conv2D(
                32, 3, padding="same", input_shape=(CANVAS_SIZE, CANVAS_SIZE, 1), name="conv1"
            ),
            keras.layers.BatchNormalization(name="bn1"),
            keras.layers.Activation("relu", name="relu1"),
            keras.layers.MaxPooling2D(2, name="pool1"),
            # Block 2
            keras.layers.Conv2D(64, 3, padding="same", name="conv2"),
            keras.layers.BatchNormalization(name="bn2"),
            keras.layers.Activation("relu", name="relu2"),
            keras.layers.MaxPooling2D(2, name="pool2"),
            # Block 3
            keras.layers.Conv2D(128, 3, padding="same", name="conv3"),
            keras.layers.BatchNormalization(name="bn3"),
            keras.layers.Activation("relu", name="relu3"),
            keras.layers.MaxPooling2D(2, name="pool3"),
            # Classifier
            keras.layers.GlobalAveragePooling2D(name="gap"),
            keras.layers.Dropout(0.4, name="dropout1"),
            keras.layers.Dense(64, activation="relu", name="dense1"),
            keras.layers.Dropout(0.3, name="dropout2"),
            keras.layers.Dense(NUM_CLASSES, activation="softmax", name="output"),
        ]
    )

    model.compile(
        optimizer=keras.optimizers.Adam(learning_rate=0.001),
        loss="sparse_categorical_crossentropy",
        metrics=["accuracy"],
    )

    return model


# ─── TF.js Export ────────────────────────────────────────────────────────────


def export_to_tfjs(model, output_dir):
    """Manual export to TF.js layers-model format (Keras 2 compatible)."""
    import json

    # Keras 2-style topology that TF.js understands
    layers_config = []
    is_first_real_layer = True
    for layer in model.layers:
        cfg = {"class_name": layer.__class__.__name__, "config": {}}
        lc = cfg["config"]
        lc["name"] = layer.name
        lc["trainable"] = True
        lc["dtype"] = "float32"

        if isinstance(layer, keras.layers.InputLayer):
            continue
        elif isinstance(layer, keras.layers.Conv2D):
            lc["filters"] = layer.filters
            lc["kernel_size"] = list(layer.kernel_size)
            lc["strides"] = list(layer.strides)
            lc["padding"] = layer.padding
            lc["data_format"] = layer.data_format
            lc["dilation_rate"] = list(layer.dilation_rate)
            lc["activation"] = "linear"
            lc["use_bias"] = layer.use_bias

        if is_first_real_layer:
            lc["batch_input_shape"] = [None, CANVAS_SIZE, CANVAS_SIZE, 1]
            is_first_real_layer = False
        elif isinstance(layer, keras.layers.BatchNormalization):
            lc["axis"] = [3]
            lc["momentum"] = 0.99
            lc["epsilon"] = 0.001
            lc["center"] = True
            lc["scale"] = True
        elif isinstance(layer, keras.layers.Activation):
            lc["activation"] = layer.get_config()["activation"]
        elif isinstance(layer, keras.layers.MaxPooling2D):
            lc["pool_size"] = list(layer.pool_size)
            lc["padding"] = layer.padding
            lc["strides"] = list(layer.strides)
            lc["data_format"] = layer.data_format
        elif isinstance(layer, keras.layers.GlobalAveragePooling2D):
            lc["data_format"] = layer.data_format
        elif isinstance(layer, keras.layers.Dropout):
            lc["rate"] = float(layer.rate)
        elif isinstance(layer, keras.layers.Dense):
            lc["units"] = layer.units
            lc["activation"] = layer.get_config()["activation"]
            lc["use_bias"] = layer.use_bias

        layers_config.append(cfg)

    topology = {
        "class_name": "Sequential",
        "config": {"name": "sequential", "layers": layers_config},
        "keras_version": "2.15.0",
        "backend": "tensorflow",
    }

    # Extract weights with layer-prefixed names
    weights_data = bytearray()
    weight_entries = []

    for layer in model.layers:
        layer_weights = layer.get_weights()
        if not layer_weights:
            continue
        weight_vars = layer.weights
        for i, w in enumerate(layer_weights):
            w = w.astype(np.float32)
            full_name = f"{layer.name}/{weight_vars[i].name}"
            weight_entries.append(
                {"name": full_name, "shape": list(w.shape), "dtype": "float32"}
            )
            weights_data.extend(w.tobytes())

    weights_filename = "group1-shard1of1.bin"
    with open(os.path.join(output_dir, weights_filename), "wb") as f:
        f.write(bytes(weights_data))

    model_json = {
        "format": "layers-model",
        "generatedBy": "keras v2.15.0",
        "convertedBy": "TensorFlow.js Converter",
        "modelTopology": topology,
        "weightsManifest": [{"paths": [weights_filename], "weights": weight_entries}],
    }

    with open(os.path.join(output_dir, "model.json"), "w") as f:
        json.dump(model_json, f)

    print("TF.js export complete!")


# ─── Training ────────────────────────────────────────────────────────────────


def train():
    print("=" * 60)
    print("CNN Shape Recognizer - Training")
    print("=" * 60)

    # 1. Generate data
    images, labels = generate_dataset()

    # 2. Split
    X_train, X_val, y_train, y_val = train_test_split(
        images, labels, test_size=0.1, random_state=42, stratify=labels
    )
    print(f"\nTrain: {len(X_train)} | Validation: {len(X_val)}")

    # 3. Create model
    model = create_model()
    model.summary()
    total_params = model.count_params()
    print(f"\nModel size: ~{total_params * 4 / 1024:.0f} KB")

    # 4. Callbacks
    callbacks = [
        keras.callbacks.ReduceLROnPlateau(
            monitor="val_loss", factor=0.3, patience=5, min_lr=1e-5, verbose=1
        ),
        keras.callbacks.EarlyStopping(
            monitor="val_accuracy", patience=15, restore_best_weights=True, verbose=1
        ),
        keras.callbacks.ModelCheckpoint(
            os.path.join(os.path.dirname(__file__), "best_model.keras"),
            monitor="val_accuracy",
            save_best_only=True,
            verbose=1,
        ),
    ]

    # 5. Train
    print(f"\nTraining for up to {MAX_EPOCHS} epochs...")
    history = model.fit(
        X_train,
        y_train,
        epochs=MAX_EPOCHS,
        batch_size=BATCH_SIZE,
        validation_data=(X_val, y_val),
        callbacks=callbacks,
    )

    # 6. Evaluate
    print("\n" + "=" * 60)
    print("Evaluation")
    print("=" * 60)

    val_loss, val_acc = model.evaluate(X_val, y_val, verbose=0)
    print(f"Validation loss: {val_loss:.4f}")
    print(f"Validation accuracy: {val_acc * 100:.2f}%")

    # Per-class accuracy
    y_pred = model.predict(X_val, verbose=0).argmax(axis=1)
    print("\nPer-class results:")
    print(classification_report(y_val, y_pred, target_names=SHAPE_NAMES))

    # Confusion matrix
    cm = confusion_matrix(y_val, y_pred)
    print("Confusion matrix:")
    print(cm)

    # 7. Inference speed
    print("\nInference speed test...")
    dummy = np.random.randn(1, CANVAS_SIZE, CANVAS_SIZE, 1).astype(np.float32)
    model.predict(dummy, verbose=0)  # warmup

    import time

    times = []
    for _ in range(100):
        start = time.perf_counter()
        model.predict(dummy, verbose=0)
        times.append((time.perf_counter() - start) * 1000)
    print(f"Average inference: {np.mean(times):.2f}ms (std: {np.std(times):.2f}ms)")

    # 8. Export to TF.js (manual converter for Keras 3 compatibility)
    print(f"\nExporting to TF.js format at: {EXPORT_PATH}")
    os.makedirs(EXPORT_PATH, exist_ok=True)

    export_to_tfjs(model, EXPORT_PATH)

    # Check exported file sizes
    total_size = 0
    for f in sorted(os.listdir(EXPORT_PATH)):
        fpath = os.path.join(EXPORT_PATH, f)
        size_kb = os.path.getsize(fpath) / 1024
        total_size += size_kb
        print(f"  {f}: {size_kb:.1f} KB")
    print(f"  Total: {total_size:.1f} KB")

    print("\nDone! Model exported to frontend/public/models/shape-recognizer/")
    print("Start the frontend to use the new model.")


if __name__ == "__main__":
    train()
