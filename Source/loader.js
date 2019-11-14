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
		//console.log("Loader running...", JSON.stringify(this.query));

		/*if (source.startsWith("<")) {
			console.log("Ignoring html");
			/*this.callback(null, source, map, meta);
			return;*#/
			return source;
		}*/

		//try { // try-catch for debugging, since webpack silently eats errors here (at least while still running)
		//source = StringReplacerPlugin.instance.SourceTransformer_CallFromLoader(source, this.options);
		source = StringReplacerPlugin.instance.SourceTransformer_CallFromLoader(source, this.query);
		//} catch(ex) {console.error(ex);}

		// if this module has the html-webpack-plugin as one of its loaders, remove ourself from the loaders list now, as otherwise it refuses to run, causing build errors
		/*if (require("html-webpack-plugin")) {
			console.log("Found plugin");
			let htmlLoader = require("html-webpack-plugin/lib/loader");
			if (this.loaders.find(a=>a.normal == htmlLoader)) {
				console.log("Found loader");
				this.loaders = [htmlLoader];
				return source;
			}
		}*/
		const htmlLoader = this.loaders.find(a=>NormalizePath(a.path).includes("/html-webpack-plugin/"));
		if (htmlLoader) {
			//this.loaders = this.loaders.filter(a=>!NormalizePath(a.path).match(/[\/\\]html-webpack-plugin[\/\\]/));
			//this.loaders = this.loaders.filter(a=>!NormalizePath(a.path).includes("/webpack-plugin-string-replace/"));
			for (let [index, loader] of this.loaders.entries()) {
				if (NormalizePath(loader.path).includes("/webpack-plugin-string-replace/")) {
					// rather than remove, we just replace our slot with html-loader (webpack will run the loader at index+1 next, so we can't remove our slot)
					this.loaders[index] = htmlLoader;
				}
			}
			//return source;
			this.callback(null, source, map, meta);
			return;
		}

		//this.cacheable && this.cacheable(); // don't re-enable; caching breaks this loader
		//return source;
		//callback(null, source, map);
		//this.callback(null, source, map);
		this.callback(null, source, map, meta);
		//console.log("Loader done...");
		return;
	} catch (ex) {
		console.error(ex);
	}
};