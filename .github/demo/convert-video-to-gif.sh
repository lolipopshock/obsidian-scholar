filename=$1

# Compress the video as an mp4 for uploading/sharing
ffmpeg -i "$filename.mov" -vcodec libx264 -crf 28 -preset veryfast -acodec aac -movflags +faststart "$filename.compressed.mp4"

# creating gif version 
# mkdir -p $filename
# ffmpeg -i $filename.mov -r 10 -f image2 $filename/image-%03d.png
# convert -delay 10 -loop 0 -resize 50% $filename/image*.png $filename.gif
# rm -rf $filename
