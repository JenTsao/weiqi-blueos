/**
 * BlueOS 本地轻量 KV 存储封装 (Storage Service)
 * 依赖 feature: blueos.storage.storage
 * 模块: @blueos.storage.storage
 */

let storageModule = null
try {
  storageModule = require('@blueos.storage.storage')
} catch (e) {
  console.warn('Storage module load failed, fallback to memory', e)
}

const memoryFallback = {}

export const storageService = {
  /**
   * 保存键值对
   */
  set(key, value) {
    const stringVal = typeof value === 'string' ? value : JSON.stringify(value)
    memoryFallback[key] = stringVal

    if (storageModule && typeof storageModule.set === 'function') {
      return new Promise((resolve) => {
        storageModule.set({
          key,
          value: stringVal,
          success: () => resolve(true),
          fail: (data, code) => {
            console.warn(`storage.set fail: ${code}`, data)
            resolve(false)
          },
        })
      })
    }
    return Promise.resolve(true)
  },

  /**
   * 读取键值对
   */
  get(key, defaultValue = null) {
    if (storageModule && typeof storageModule.get === 'function') {
      return new Promise((resolve) => {
        storageModule.get({
          key,
          default: '',
          success: (data) => {
            if (data !== undefined && data !== null && data !== '') {
              try {
                resolve(JSON.parse(data))
              } catch (e) {
                resolve(data)
              }
            } else {
              resolve(defaultValue)
            }
          },
          fail: (data, code) => {
            console.warn(`storage.get fail: ${code}`, data)
            const fallback = memoryFallback[key]
            if (fallback !== undefined) {
              try {
                resolve(JSON.parse(fallback))
              } catch (e) {
                resolve(fallback)
              }
            } else {
              resolve(defaultValue)
            }
          },
        })
      })
    }

    const fallback = memoryFallback[key]
    if (fallback !== undefined) {
      try {
        return Promise.resolve(JSON.parse(fallback))
      } catch (e) {
        return Promise.resolve(fallback)
      }
    }
    return Promise.resolve(defaultValue)
  },
}
