#!/usr/bin/env bash

docker compose down
sudo rm -rf ./volumes
docker compose pull
