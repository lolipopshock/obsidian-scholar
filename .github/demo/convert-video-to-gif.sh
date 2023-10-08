filename=$1
mkdir -p $filename
# ffmpeg -i $filename.mov -r 10 -f image2 $filename/image-%03d.png
convert -delay 10 -loop 0 -resize 50% $filename/image*.png $filename.gif
rm -rf $filename
