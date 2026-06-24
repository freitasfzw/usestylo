#!/bin/bash

echo "Mensagem do commit:"
read msg

git add .
git commit -m "$msg"
git push

echo ""
echo "Concluído!"

