var StringReplacerPlugin = require('./index.js');

// IMPORTANT: LOADERS ARE NOT ALWAYS CALLED DETERMINISTICALLY / IN THE SAME ORDER
// So make sure any code it runs is robust to out-of-order effects.

function NormalizePath(path) {
	return path.replace(/\\/g, "/") // normalize path to have "/" separators
}

//module.exports = function(source, map) {
module.exports = function(source, map, meta) {
	try {
		//var callback = this.async();

		source = StringReplacerPlugin.instance.SourceTransformer_CallFromLoader(source, this.query);

		// if this module has the html-webpack-plugin as one of its loaders, remove/hide ourself from the loaders list, as otherwise it refuses to run, causing build errors
		const htmlLoader = this.loaders.find(a=>NormalizePath(a.path).includes("/html-webpack-plugin/"));
		if (htmlLoader) {
			for (let [index, loader] of this.loaders.entries()) {
				if (NormalizePath(loader.path).includes("/webpack-plugin-string-replace/")) {
					// rather than remove, we just replace our slot with html-loader (webpack will run the loader at index+1 next, so we can't remove our slot)
					this.loaders[index] = htmlLoader;
				}
			}
		}

		//this.cacheable && this.cacheable(); // don't re-enable; caching breaks this loader
		//callback(null, source, map);
		//this.callback(null, source, map);
		/*this.callback(null, source, map, meta);
		return;*/
		return source;
	} catch (ex) {
		console.error(ex);
	}
};