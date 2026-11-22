// PptxGenJS declares these modules browser-disabled. Normalize the Node scheme
// so webpack applies the package's own browser mappings in the client build.
export default {
  webpack(config, {isServer, webpack}) {
    if (!isServer) config.plugins.push(new webpack.NormalModuleReplacementPlugin(
      /^node:(fs|https)$/, resource => {
        if (resource.context.includes('pptxgenjs')) resource.request = resource.request.slice(5)
      }
    ))
    return config
  }
}
