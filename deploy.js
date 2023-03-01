/* eslint-disable no-undef */
/* eslint-disable no-unused-vars */
/* eslint-disable camelcase */
/* eslint-disable prefer-const */
/* eslint-disable no-use-before-define */
import cmd from 'node-cmd';
let cmd = require 'node-cmd';

let path; let node_ssh; let ssh; let fs;
fs = require('fs');
path = require('path');
// eslint-disable-next-line camelcase
node_ssh = require('node-ssh');

ssh = new node_ssh.NodeSSH();

// the method that starts the deployment process
function main() {
  console.log('Deployment started.');
  sshConnect();
}

// installs PM2
function installPM2() {
  return ssh.execCommand('sudo npm install pm2 -g', {
    cwd: '/home/ubuntu',
  });
}

// transfers local project to the remote server
function transferProjectToRemote(failed, successful) {
  return ssh.putDirectory('../hackathon-starter',
    '/home/ubuntu/hackathon-starter-temp',
    {
      recursive: true,
      concurrency: 1,
      validate(itemPath) {
        const baseName = path.basename(itemPath);
        return (
          // do not allow dot files
          // do not allow node_modules
          baseName.substr(0, 1) !== '.' && baseName !== 'node_modules'
        );
      },
      tick(localPath, remotePath, error) {
        if (error) {
          failed.push(localPath);
          console.log(`failed.push: ${localPath}`);
        } else {
          successful.push(localPath);
          console.log(`successful.push: ${localPath}`);
        }
      },
    });
}

// creates a temporary folder on the remote server
function createRemoteTempFolder() {
  return ssh.execCommand('rm -rf hackathon-starter-temp && mkdir hackathon-starter-temp',
    {
      cwd: '/home/ubuntu',
    });
}

// stops mongodb and node services on the remote server
function stopRemoteServices() {
  return ssh.execCommand('pm2 stop all && sudo service mongod stop', {
    cwd: '/home/ubuntu',
  });
}

// delete the project folder
function removeProjectApp() {
  return ssh.execCommand('rm -rf hackathon-starter', {
    cwd: '/home/ubuntu',
  });
}

// updates the project source on the server
function updateRemoteApp() {
  return ssh.execCommand('mkdir hackathon-starter && cp -r hackathon-starter-temp/* hackathon-starter/ && rm -rf hackathon-starter-temp',
    {
      cwd: '/home/ubuntu',
    });
}

function installNodeModules() {
  return ssh.execCommand('npm install', {
    cwd: '/home/ubuntu/hackathon-starter',
  });
}

// restart mongodb and node services on the remote server
function restartRemoteServices() {
  return ssh.execCommand('cd hackathon-starter && sudo service mongod start && pm2 start bin/www',
    {
      cwd: '/home/ubuntu',
    });
}

// connect to the remote server
function sshConnect() {
  console.log('Connecting to the server...');

  ssh
    .connect({
      // TODO: ADD YOUR IP ADDRESS BELOW, in place of the zeros below
      host: '18.204.16.60',
      username: 'ubuntu',
      privateKeyPath: 'labsuser.pem',
    })
    .then(() => {
      console.log('SSH Connection established.');
      console.log('Installing PM2...');
      return installPM2();
    })
    .then(() => {
      console.log('Removing `hackathon-starter` folder.');
      return removeProjectApp();
    })
    .then(() => {
      console.log('Creating `hackathon-starter-temp` folder.');
      return createRemoteTempFolder();
    })
    .then((result) => {
      const failed = [];
      const successful = [];
      if (result.stdout) {
        console.log(`STDOUT: ${result.stdout}`);
      }
      if (result.stderr) {
        console.log(`STDERR: ${result.stderr}`);
        return Promise.reject(result.stderr);
      }
      console.log('Transferring files to remote server...');
      return transferProjectToRemote(failed, successful);
    })
    .then((status) => {
      if (status) {
        console.log('Stopping remote services.');
        return stopRemoteServices();
      }
      return Promise.reject(failed.join(', '));
    })
    .then((status) => {
      if (status) {
        console.log('Updating remote app.');
        return updateRemoteApp();
      }
      return Promise.reject(failed.join(', '));
    })
    .then(() => {
      console.log('Installing node modules.');
      return installNodeModules();
    })
    .then(() => {
      console.log('Restarting remote services...');
      return restartRemoteServices();
    })
    .then(() => {
      console.log('DEPLOYMENT COMPLETE!');
      process.exit(0);
    })
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}

main();
