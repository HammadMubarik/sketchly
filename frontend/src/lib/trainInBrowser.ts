/**
 * Browser-Based Model Training
 * Train the CNN model directly in the browser (more reliable than Node.js on Windows)
 */

import * as tf from '@tensorflow/tfjs'
import { ShapeDataGenerator } from './shapeGenerator'
import { createCNNModel, compileCNNModel, getModelSummary } from './cnnShapeModel'

export async function trainModelInBrowser() {
  console.log('=== CNN Shape Recognizer Training (Browser) ===\n')

  // 1. Generate dataset
  console.log('Step 1: Generating training dataset...')
  console.log('This may take a minute...')

  const generator = new ShapeDataGenerator()
  const dataset = generator.generateDataset({
    canvasSize: 28,
    samplesPerClass: 2000, // 2000 * 15 = 30,000 samples (reduced for browser)
    augmentationPasses: 6,
  })

  console.log(`Dataset generated: ${dataset.inputs.length} samples`)

  // 2. Convert to tensors
  console.log('\nStep 2: Converting to tensors...')
  const xs = tf.tensor4d(
    Float32Array.from(dataset.inputs.flatMap((img) => Array.from(img))),
    [dataset.inputs.length, 28, 28, 1]
  )
  const ys = tf.oneHot(dataset.labels, 8)

  console.log(`Input shape: ${xs.shape}`)
  console.log(`Label shape: ${ys.shape}`)

  // 3. Shuffle
  console.log('\nStep 3: Shuffling dataset...')
  const indicesArray = tf.util.createShuffledIndices(dataset.inputs.length)
  const indices = tf.tensor1d(Array.from(indicesArray), 'int32')
  const shuffledXs = xs.gather(indices)
  const shuffledYs = ys.gather(indices)
  xs.dispose()
  ys.dispose()
  indices.dispose()

  // 4. Split train/val
  console.log('\nStep 4: Splitting into train/validation...')
  const numTrain = Math.floor(dataset.inputs.length * 0.9)
  const trainXs = shuffledXs.slice([0, 0, 0, 0], [numTrain, 28, 28, 1])
  const trainYs = shuffledYs.slice([0, 0], [numTrain, 8])
  const valXs = shuffledXs.slice([numTrain, 0, 0, 0], [-1, 28, 28, 1])
  const valYs = shuffledYs.slice([numTrain, 0], [-1, 8])

  console.log(`Training samples: ${numTrain}`)
  console.log(`Validation samples: ${dataset.inputs.length - numTrain}`)

  shuffledXs.dispose()
  shuffledYs.dispose()

  // 5. Create model
  console.log('\nStep 5: Creating model...')
  const model = createCNNModel(28)
  compileCNNModel(model)
  getModelSummary(model)

  // 6. Train
  console.log('\nStep 6: Training model...')
  console.log('This will take 5-10 minutes...\n')

  const startTime = Date.now()

  await model.fit(trainXs, trainYs, {
    epochs: 30,
    batchSize: 32,
    validationData: [valXs, valYs],
    callbacks: {
      onEpochEnd: (epoch, logs) => {
        const loss = logs?.loss?.toFixed(4) ?? '?'
        const acc = ((logs?.acc ?? 0) * 100).toFixed(2)
        const valLoss = logs?.val_loss?.toFixed(4) ?? '?'
        const valAcc = ((logs?.val_acc ?? 0) * 100).toFixed(2)

        console.log(
          `Epoch ${(epoch + 1).toString().padStart(2)}/30: ` +
            `loss=${loss} acc=${acc}% | ` +
            `val_loss=${valLoss} val_acc=${valAcc}%`
        )
      },
    },
  })

  const trainingTime = ((Date.now() - startTime) / 1000 / 60).toFixed(1)
  console.log(`\nTraining completed in ${trainingTime} minutes`)

  // 7. Evaluate
  console.log('\nStep 7: Final evaluation...')
  const evalResult = model.evaluate(valXs, valYs) as tf.Tensor[]
  const [finalLoss, finalAcc] = await Promise.all(evalResult.map((t) => t.data()))
  console.log(`Final validation loss: ${finalLoss[0].toFixed(4)}`)
  console.log(`Final validation accuracy: ${(finalAcc[0] * 100).toFixed(2)}%`)
  evalResult.forEach((t) => t.dispose())

  // 8. Test inference speed
  console.log('\nStep 8: Testing inference speed...')
  const testInput = tf.randomNormal([1, 28, 28, 1])
  model.predict(testInput) // warm up

  const numInferences = 100
  const inferenceStart = performance.now()
  for (let i = 0; i < numInferences; i++) {
    model.predict(testInput)
  }
  const inferenceTime = (performance.now() - inferenceStart) / numInferences
  console.log(`Average inference time: ${inferenceTime.toFixed(2)}ms`)
  testInput.dispose()

  // 9. Save model
  console.log('\nStep 9: Saving model...')
  await model.save('downloads://shape-recognizer')
  console.log('Model downloaded! Move the files to frontend/public/models/shape-recognizer/')

  // Clean up
  trainXs.dispose()
  trainYs.dispose()
  valXs.dispose()
  valYs.dispose()

  console.log('\n=== Training Complete! ===')

  return model
}

// Export for console use
if (typeof window !== 'undefined') {
  (window as any).trainModelInBrowser = trainModelInBrowser
  console.log('Training function available! Run: window.trainModelInBrowser()')
}
