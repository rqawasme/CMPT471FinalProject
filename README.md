# CMPT471 - Performance Evaluation of Bitrate Adaptation Algorithm on DASH

Team ID: 14

Team Member
- Rashid Qawasmeh
- Yi-Hsuan Wu
- Haichao Wan


## Environment Set-up
Binaries to the set-up (provided by Dr.Diab)
https://vault.sfu.ca/index.php/s/kwJjOlCAKWJ6KuJ

Ubuntu 20.04.1
DASH.js 3.2.0 (instead of 2.3.0 as specified from the binary)


## How to run:

After cloning project, run
- replace nginx.conf with default one in /etc/nginx
- create a folder named streaming and place it in /var/www/html/ (the default root directory of nginx)
- put dash.js, videos under streaming folder (/var/www/html/streaming/dash.js and /var/www/html/streaming/videos)
- open dash.js and `npm install` #installs the dependencies (if npm fails, install with `cnpm install` instead)
- grunt dev in dash.js #generates all libraries (if `grunt dev` fails, run `*grunt -force`)
- start the nginx server
- go to http://localhost:8080/samples/dash-if-reference-player/index.html
- click show options, select BUFFER BASED
- load a video of mdp and observe


## Performance Evaluation
Check [Algorithms Observations] folder

## References
Te-Yuan Huang, Ramesh Johari, Nick McKeown, Matthew Trunnell, and Mark Watson. 2014. A buffer-based approach to rate adaptation: evidence from a large video streaming service. In Proceedings of the 2014 ACM conference on SIGCOMM (SIGCOMM '14). ACM, New York, NY, USA, 187-198. DOI: https://doi.org/10.1145/2619239.2626296
