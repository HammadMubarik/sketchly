/**
 * CNN Model Architecture for Shape Recognition
 * Lightweight model optimized for <100KB size and <20ms inference
 */

import * as tf from '@tensorflow/tfjs'

export function createCNNModel(inputSize: number = 28): tf.Sequential {
  const model = tf.sequential({
    layers: [
      // Input: 28x28x1 (or 64x64x1)
      tf.layers.conv2d({
        inputShape: [inputSize, inputSize, 1],
        filters: 16,
        kernelSize: 3,
        activation: 'relu',
        padding: 'same',
        name: 'conv1',
      }),
      tf.layers.maxPooling2d({
        poolSize: 2,
        name: 'pool1',
      }),
      // 14x14x16 (or 32x32x16)

      tf.layers.conv2d({
        filters: 32,
        kernelSize: 3,
        activation: 'relu',
        padding: 'same',
        name: 'conv2',
      }),
      tf.layers.maxPooling2d({
        poolSize: 2,
        name: 'pool2',
      }),
      // 7x7x32 (or 16x16x32)

      tf.layers.conv2d({
        filters: 32,
        kernelSize: 3,
        activation: 'relu',
        padding: 'same',
        name: 'conv3',
      }),
      tf.layers.maxPooling2d({
        poolSize: 2,
        name: 'pool3',
      }),
      // 3x3x32 (or 8x8x32)

      tf.layers.flatten({
        name: 'flatten',
      }),

      tf.layers.dense({
        units: 64,
        activation: 'relu',
        name: 'dense1',
      }),
      tf.layers.dropout({
        rate: 0.3,
        name: 'dropout',
      }),

      tf.layers.dense({
        units: 15, // 15 shape classes
        activation: 'softmax',
        name: 'output',
      }),
    ],
  })

  return model
}

export function compileCNNModel(model: tf.Sequential): void {
  model.compile({
    optimizer: tf.train.adam(0.001),
    loss: 'categoricalCrossentropy',
    metrics: ['accuracy'],
  })
}

export const SHAPE_CLASSES = [
  'circle',
  'ellipse',
  'square',
  'rectangle',
  'triangle',
  'line',
  'arrow',
  'double-arrow',
  'star',
  'pentagon',
  'hexagon',
  'diamond',
  'check',
  'x',
  'heart',
]

export function getModelSummary(model: tf.Sequential): void {
  console.log('Model Summary:')
  model.summary()

  // Calculate approximate size
  const numParams = model.countParams()
  const sizeKB = (numParams * 4) / 1024 // 4 bytes per float32 parameter
  console.log(`\nApproximate model size: ${sizeKB.toFixed(1)} KB`)
  console.log(`Total parameters: ${numParams.toLocaleString()}`)
}
