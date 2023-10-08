# make a dev-obsidian-scholar if not exists 
# and pseudo link the plugin files to the folder 

if [ ! -d ./dev-obsidian-scholar/.obsidian/plugins/obscholar ]; then
    mkdir -p ./dev-obsidian-scholar/.obsidian/plugins/obscholar
fi

ln -s $(realpath build/main.js) ./dev-obsidian-scholar/.obsidian/plugins/obscholar/main.js 
ln -s $(realpath manifest.json) ./dev-obsidian-scholar/.obsidian/plugins/obscholar/manifest.json
ln -s $(realpath build/styles.css) ./dev-obsidian-scholar/.obsidian/plugins/obscholar/styles.css