// Build & Deploy pipeline script for triage application auto deployment on host machine
// These steps are run on latest changes of MAIN BRANCH (develop) OR, on PR merge to develop

MAIN_BRANCH = 'develop'
IMAGE_NAME = "triage-app:${BRANCH_NAME}-v${BUILD_NUMBER}"
CONTAINER_NAME = "triage-app"

pipeline {
    agent {
        label 'triage-app-server'
    }

    stages {
        stage ('Exit Check') {
            when {
                not { branch MAIN_BRANCH}
            }
            steps {
                echo "Build & Deploy not supported for non - ${MAIN_BRANCH} branch"
                // Since each image is about 500MB, Skip next stages
                // to avoid creation of images on other branches
                script {
                    currentBuild.result = 'ABORTED'
                    error("Aborting the build, since it is not a main branch!")
                }
            }
        }
        stage ('Clean up') {
            steps {
                sh "git clean -fxd"
            }
        }
        stage ('Checkout') {
            steps {
                checkout scm
            }
        }
        stage ('Build') {
            steps {
                build_docker()
            }
        }
        stage ('Deploy') {
            steps {
                deploy()
            }
        }
    }
    post {
        failure {
            script{
                // Notify slack when job fails on MAIN_BRANCH
                if ("${BRANCH_NAME}" == "${MAIN_BRANCH}"){
                    notify_failure_slack()
                }
            }
        }
        success {
            echo "${CONTAINER_NAME} is up and running"
        }
    }
}


def build_docker() {
       sh "docker build -t ${IMAGE_NAME} ."
}

def deploy(){
    echo "Stoping existing docker container: ${CONTAINER_NAME}"
    sh """
        if [[ "\$(docker ps -q -f 'NAME=${CONTAINER_NAME}')" = "" ]]
        then
            echo "Container ${CONTAINER_NAME} is not running"
        else
           docker stop \$(docker ps -q -f 'NAME=${CONTAINER_NAME}') && docker rm \$_
        fi
    """
    echo "Remove stopped/unused containers:"
    sh "docker container prune -f"
    echo "Running deployment:"
    sh "docker run -d --env-file=/etc/.env_triage_app" +
        " --name ${CONTAINER_NAME} -p 443:5000 ${IMAGE_NAME}"
}

def notify_failure_slack() {
    def SLACK_CHANNEL = "#team-daedalus-log"
    def slack_token = "RzW5e9x25i2C03ODCNWTKMFX"

    // Replace encoded slashes
    def job = env.JOB_NAME.replaceAll("%2F","/")
    def projectText = "\nJob Path: ${job}\nURL: ${env.BUILD_URL})"

    def msg = ":closed_book: " +
        "'${CONTAINER_NAME}' deployment with latest develop changes FAILED!" +
        "${projectText}\nPlease analyse and restart the container ASAP! <!here>"

    slackSend channel: "${SLACK_CHANNEL}", message: msg, teamDomain :"autodesk", token:slack_token, color:"danger"
}