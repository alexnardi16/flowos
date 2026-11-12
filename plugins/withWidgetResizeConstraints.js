const { withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * react-native-android-widget exposes resizeMode and default dimensions, but
 * does not expose Android's minResizeWidth/minResizeHeight provider attributes.
 * Add those attributes after its config plugin has generated the provider XML.
 */
module.exports = function withWidgetResizeConstraints(config) {
  return withDangerousMod(config, ['android', async (config) => {
    const xmlDir = path.join(config.modRequest.projectRoot, 'android', 'app', 'src', 'main', 'res', 'xml');
    const constraints = [
      { provider: 'todayandroidwidget', width: '180dp', height: '110dp' },
      { provider: 'calendarandroidwidget', width: '180dp', height: '160dp' },
    ];

    if (!fs.existsSync(xmlDir)) {
      throw new Error('FlowOS widget resize patch could not find Android res/xml directory');
    }

    const xmlFiles = fs.readdirSync(xmlDir).filter(file => file.endsWith('.xml'));
    for (const constraint of constraints) {
      const file = xmlFiles.find(name => name.toLowerCase().includes(constraint.provider));
      if (!file) {
        throw new Error(`FlowOS widget resize patch could not find provider XML for ${constraint.provider}`);
      }

      const filePath = path.join(xmlDir, file);
      let source = fs.readFileSync(filePath, 'utf8');
      if (!source.includes('<appwidget-provider')) {
        throw new Error(`FlowOS widget resize patch found an invalid provider XML: ${file}`);
      }

      const root = source.match(/<appwidget-provider\\b[^>]*>/);
      if (!root) throw new Error(`FlowOS widget resize patch could not parse provider XML: ${file}`);

      let openingTag = root[0];
      const attributes = {
        'android:minResizeWidth': constraint.width,
        'android:minResizeHeight': constraint.height,
      };
      for (const [name, value] of Object.entries(attributes)) {
        const escapedName = name.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&');
        const attributePattern = new RegExp(`\\\\s+${escapedName}="[^"]*"`);
        if (attributePattern.test(openingTag)) {
          openingTag = openingTag.replace(attributePattern, ` ${name}="${value}"`);
        } else {
          openingTag = openingTag.replace(/\\s*\\/?>(?=$)/, ` ${name}="${value}"${openingTag.endsWith('/>') ? ' />' : '>'}`);
        }
      }

      source = source.replace(root[0], openingTag);
      fs.writeFileSync(filePath, source);
    }

    return config;
  }]);
};
