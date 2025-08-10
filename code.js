// Показываем UI
figma.showUI(__html__, { width: 380, height: 450 });

// Функция конвертации HEX в RGBA
function hexToRgba(hex) {
  if (typeof hex === 'object') return hex;
  
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16) / 255,
    g: parseInt(result[2], 16) / 255,
    b: parseInt(result[3], 16) / 255,
    a: 1
  } : null;
}

// Функция конвертации RGBA в HEX
function rgbaToHex(rgba) {
  const r = Math.round(rgba.r * 255);
  const g = Math.round(rgba.g * 255);
  const b = Math.round(rgba.b * 255);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`.toUpperCase();
}

// Обработчик сообщений от UI
figma.ui.onmessage = async (msg) => {
  if (msg.type === 'export-variables') {
    try {
      const collections = await figma.variables.getLocalVariableCollectionsAsync();
      const variables = await figma.variables.getLocalVariablesAsync();
      
      const exportData = {
        timestamp: new Date().toISOString(),
        collections: {},
        variables: {}
      };
      
      collections.forEach(collection => {
        exportData.collections[collection.id] = {
          id: collection.id,
          name: collection.name,
          modes: collection.modes.map(mode => ({
            modeId: mode.modeId,
            name: mode.name
          })),
          defaultModeId: collection.defaultModeId,
          remote: collection.remote,
          key: collection.key,
          variableIds: collection.variableIds
        };
      });
      
      variables.forEach(variable => {
        exportData.variables[variable.id] = {
          id: variable.id,
          name: variable.name,
          key: variable.key,
          variableCollectionId: variable.variableCollectionId,
          resolvedType: variable.resolvedType,
          valuesByMode: variable.valuesByMode,
          remote: variable.remote,
          description: variable.description
        };
      });
      
      figma.ui.postMessage({
        type: 'download-json',
        data: JSON.stringify(exportData, null, 2),
        filename: `figma-variables-${new Date().toISOString().split('T')[0]}.json`
      });
      
    } catch (error) {
      figma.ui.postMessage({
        type: 'error',
        message: error.message
      });
    }
  }
  
  if (msg.type === 'rename-frames') {
    try {
      const selection = figma.currentPage.selection;
      
      if (selection.length === 0) {
        figma.ui.postMessage({
          type: 'error',
          message: 'Select frames to rename'
        });
        return;
      }
      
      let renamedCount = 0;
      
      for (const node of selection) {
        if (node.type === 'FRAME') {
          // Ищем текстовые элементы внутри фрейма
          const textNodes = node.findAll(child => child.type === 'TEXT');
          
          if (textNodes.length > 0) {
            // Берем текст из первого найденного текстового элемента
            const textContent = textNodes[0].characters.trim();
            if (textContent) {
              node.name = textContent;
              renamedCount++;
            }
          }
        }
      }
      
        figma.ui.postMessage({
          type: 'rename-success',
          message: `Renamed ${renamedCount} frames`
        });
      
    } catch (error) {
      figma.ui.postMessage({
        type: 'error',
        message: `Rename error: ${error.message}`
      });
    }
  }
  
if (msg.type === 'scan-palette') {
  try {
    const selection = figma.currentPage.selection;
    
    if (selection.length === 0) {
      figma.ui.postMessage({
        type: 'error',
        message: 'Select folders with color palettes'
      });
      return;
    }
    
    const modes = [];
    const shadeNames = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950'];
    
    // Проходим по выделенным объектам (главным папкам)
    for (const node of selection) {
      if (node.type === 'FRAME' || node.type === 'GROUP') {
        const modeName = node.name;
        
        // Ищем промежуточную папку "Color" или похожую
        let colorFolder = null;
        for (const child of node.children) {
          if ((child.type === 'FRAME' || child.type === 'GROUP') && 
              (child.name.toLowerCase().includes('color') || 
               child.name.toLowerCase().includes('колор') ||
               child.children.length >= 5)) {
            colorFolder = child;
            break;
          }
        }
        
        // Если не нашли промежуточную папку, работаем с текущей
        const targetFolder = colorFolder || node;
        const colors = {};
        
        // Ищем дочерние объекты с цветами
        const children = targetFolder.children;
        
        for (const child of children) {
          if (child.type === 'RECTANGLE' || child.type === 'ELLIPSE' || child.type === 'FRAME') {
            let shadeName = null;
            
            // 1. Сначала ищем точное совпадение в имени объекта
            for (const shade of shadeNames) {
              if (child.name === shade) {
                shadeName = shade;
                break;
              }
            }
            
            // 2. Если не нашли точное совпадение, ищем в текстовых элементах
            if (!shadeName) {
              const findTextRecursively = (node) => {
                if (node.type === 'TEXT') {
                  return [node];
                }
                if ('children' in node) {
                  let textNodes = [];
                  for (const child of node.children) {
                    textNodes = textNodes.concat(findTextRecursively(child));
                  }
                  return textNodes;
                }
                return [];
              };
              
              const allTextNodes = findTextRecursively(child);
              
              for (const textNode of allTextNodes) {
                const textContent = textNode.characters.trim();
                
                // Ищем точное совпадение с номерами
                for (const shade of shadeNames) {
                  if (textContent === shade) {
                    shadeName = shade;
                    break;
                  }
                }
                if (shadeName) break;
              }
            }
            
            // 3. Если все еще не нашли, пробуем частичное совпадение в имени
            if (!shadeName) {
              for (const shade of shadeNames) {
                if (child.name.includes(shade)) {
                  shadeName = shade;
                  break;
                }
              }
            }
            
            // НЕ используем позицию в массиве - это вызывает ошибки!
            
            // Если нашли shade, извлекаем цвет
            if (shadeName && child.fills && child.fills.length > 0) {
              const fill = child.fills[0];
              if (fill.type === 'SOLID') {
                // Проверяем, не перезаписываем ли мы уже найденный цвет
                if (colors[shadeName]) {
                  console.log(`WARNING: Color ${shadeName} already found! Skipping object "${child.name}"`);
                } else {
                  colors[shadeName] = rgbaToHex(fill.color);
                  console.log(`Found color ${shadeName}: ${colors[shadeName]} in object "${child.name}"`);
                }
              }
            } else {
              console.log(`Could not determine shade for object "${child.name}"`);
            }
          }
        }
        
        // Проверяем результат
        const foundShades = Object.keys(colors);
  console.log(`Colors found for ${modeName}:`, colors);
  console.log(`Total found: ${foundShades.length} of ${shadeNames.length}`);
        
        if (foundShades.length >= 5) {
          modes.push({
            name: modeName,
            colors: colors
          });
        } else {
          console.log(`Palette ${modeName} skipped: not enough colors (${foundShades.length})`);
        }
      }
    }
    
    if (modes.length === 0) {
      figma.ui.postMessage({
        type: 'error',
        message: 'No suitable palettes found. Check the console for debugging.'
      });
      return;
    }
    
    figma.ui.postMessage({
      type: 'palette-scanned',
      modes: modes,
      data: modes
    });
    
  } catch (error) {
    figma.ui.postMessage({
      type: 'error',
      message: `Scan error: ${error.message}`
    });
  }
}



  
  if (msg.type === 'import-palette') {
    try {
      const paletteData = msg.data;
      
      // Создаем новую коллекцию
      const collection = figma.variables.createVariableCollection('New Color Collection');
      
      // Создаем моды
      const modeMap = {};
      
      // Первый мод уже существует
      if (paletteData.length > 0) {
        collection.renameMode(collection.modes[0].modeId, paletteData[0].name);
        modeMap[0] = collection.modes[0].modeId;
      }
      
      // Создаем остальные моды
      for (let i = 1; i < paletteData.length; i++) {
        const newMode = collection.addMode(paletteData[i].name);
        modeMap[i] = newMode;
      }
      
      // Определяем все возможные shade'ы и правильно сортируем их
      const allShades = new Set();
      paletteData.forEach(mode => {
        Object.keys(mode.colors).forEach(shade => allShades.add(shade));
      });
      
      // Правильная сортировка shade'ов
      const sortedShades = Array.from(allShades).sort((a, b) => {
        const numA = parseInt(a);
        const numB = parseInt(b);
        return numA - numB;
      });
      
      console.log('Сортированные shade\'ы:', sortedShades); // Для отладки
      
      // Создаем переменные для каждого shade
      for (const shade of sortedShades) {
        const variable = figma.variables.createVariable(shade, collection, 'COLOR');
        
        // Устанавливаем значения для каждого мода
        paletteData.forEach((mode, index) => {
          if (mode.colors[shade]) {
            const rgbaColor = hexToRgba(mode.colors[shade]);
            if (rgbaColor) {
              variable.setValueForMode(modeMap[index], rgbaColor);
            }
          }
        });
      }
      
        figma.ui.postMessage({
          type: 'import-success',
          message: `Created collection "${collection.name}" with ${paletteData.length} modes and ${sortedShades.length} variables.`
        });
      
    } catch (error) {
      figma.ui.postMessage({
        type: 'error',
        message: `Palette creation error: ${error.message}`
      });
    }
  }
  
  if (msg.type === 'import-variables') {
    try {
      const jsonData = JSON.parse(msg.data);
      
      const collectionMap = {};
      const modeMap = {};
      const createdCollections = {};
      
      for (const [oldId, collectionData] of Object.entries(jsonData.collections)) {
        const newCollection = figma.variables.createVariableCollection(collectionData.name);
        collectionMap[oldId] = newCollection.id;
        createdCollections[oldId] = newCollection;
        
        const modes = collectionData.modes;
        if (modes.length > 1) {
          newCollection.renameMode(newCollection.modes[0].modeId, modes[0].name);
          modeMap[modes[0].modeId] = newCollection.modes[0].modeId;
          
          for (let i = 1; i < modes.length; i++) {
            const newMode = newCollection.addMode(modes[i].name);
            modeMap[modes[i].modeId] = newMode;
          }
        } else if (modes.length === 1) {
          newCollection.renameMode(newCollection.modes[0].modeId, modes[0].name);
          modeMap[modes[0].modeId] = newCollection.modes[0].modeId;
        }
      }
      
      for (const [oldId, variableData] of Object.entries(jsonData.variables)) {
        const collection = createdCollections[variableData.variableCollectionId];
        
        if (collection) {
          const newVariable = figma.variables.createVariable(
            variableData.name,
            collection,
            variableData.resolvedType
          );
          
          if (variableData.description) {
            newVariable.description = variableData.description;
          }
          
          for (const [oldModeId, value] of Object.entries(variableData.valuesByMode)) {
            const newModeId = modeMap[oldModeId];
            if (newModeId) {
              let finalValue = value;
              if (variableData.resolvedType === 'COLOR' && typeof value === 'string') {
                finalValue = hexToRgba(value);
              }
              
              if (finalValue) {
                newVariable.setValueForMode(newModeId, finalValue);
              }
            }
          }
        }
      }
      
        figma.ui.postMessage({
          type: 'import-success',
          message: `Imported ${Object.keys(jsonData.collections).length} collections and ${Object.keys(jsonData.variables).length} variables.`
        });
      
    } catch (error) {
      figma.ui.postMessage({
        type: 'error',
        message: `Import error: ${error.message}`
      });
    }
  }
  
  if (msg.type === 'cancel') {
    figma.closePlugin();
  }
};
