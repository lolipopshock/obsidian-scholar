# make a dev-obsidian-folder if not exists 
# and pseudo link the plugin files to the folder 

if [ ! -d ./dev-obsidian-folder/.obsidian/plugins/obscholar ]; then
    mkdir -p ./dev-obsidian-folder/.obsidian/plugins/obscholar
fi

ln -s $(realpath main.js) ./dev-obsidian-folder/.obsidian/plugins/obscholar/main.js 
ln -s $(realpath manifest.json) ./dev-obsidian-folder/.obsidian/plugins/obscholar/manifest.json
ln -s $(realpath src/styles.css) ./dev-obsidian-folder/.obsidian/plugins/obscholar/styles.css