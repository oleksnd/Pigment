// Этот плагин экспортирует все переменные Figma в JSON файл
// Код имеет доступ к документу Figma через глобальный объект figma
// Browser APIs доступны в <script> теге внутри "ui.html"

// Показываем HTML страницу из "ui.html"
figma.showUI(__html__, { width: 320, height: 240 });

// Интерфейс для типизации сообщений
interface PluginMessage {
  type: string;
}

// Обработчик сообщений от UI
figma.ui.onmessage = async (msg: PluginMessage) => {
  // Используем объект с "type" свойством для различения типов сообщений
  if (msg.type === 'export-variables') {
    try {
      // Получаем все локальные коллекции переменных
      const collections = figma.variables.getLocalVariableCollections();
      const variables = figma.variables.getLocalVariables();
      
      const exportData = {
        timestamp: new Date().toISOString(),
        collections: {} as Record<string, any>,
        variables: {} as Record<string, any>
      };
      
      // Экспортируем коллекции с их модами
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
      
      // Экспортируем все переменные со всеми значениями
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
      
      // Отправляем данные обратно в UI для скачивания
      figma.ui.postMessage({
        type: 'download-json',
        data: JSON.stringify(exportData, null, 2),
        filename: `figma-variables-${new Date().toISOString().split('T')[0]}.json`
      });
      
    } catch (error) {
      // Обработка ошибок
      figma.ui.postMessage({
        type: 'error',
        message: error instanceof Error ? error.message : 'Неизвестная ошибка'
      });
    }
    
    // НЕ закрываем плагин сразу, ждем завершения скачивания
    return;
  }
  
  if (msg.type === 'close-plugin') {
    // Закрываем плагин когда пользователь нажимает "Закрыть"
    // Важно закрыть плагин, иначе он будет продолжать работать
    figma.closePlugin();
  }
};
